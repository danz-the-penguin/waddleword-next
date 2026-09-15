// src-tauri/src/endgame.rs - Terminal Endgame Alpha-Beta Minimax Solver with 64-bit Zobrist Transposition Table

use crate::board::{Board, LETTER_SCORES};
use crate::gaddag::Gaddag;
use crate::generator::{CandidatePlay, MoveGenerator};
use crate::zobrist::{
    compute_initial_hash, hash_after_pass, hash_after_play, rack_to_counts,
};

#[derive(Debug, Clone)]
pub struct EndgameResult {
    pub best_play: Option<CandidatePlay>,
    pub terminal_margin: i16,
    pub principal_variation: Vec<String>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum TTFlag {
    Exact,      // True minimax score (alpha < score < beta)
    LowerBound, // Fail-high / Beta cutoff (score >= beta)
    UpperBound, // Fail-low / Alpha cutoff (score <= alpha)
}

#[derive(Clone, Copy, Debug)]
pub struct TTEntry {
    pub hash_key: u64,
    pub depth: u8,
    pub margin: i16,
    pub flag: TTFlag,
    pub best_word: [u8; 16],
    pub best_word_len: u8,
}

pub struct TranspositionTable {
    entries: Vec<Option<TTEntry>>,
    mask: usize,
}

impl TranspositionTable {
    pub fn new(power_of_two: usize) -> Self {
        let size = 1 << power_of_two;
        Self {
            entries: vec![None; size],
            mask: size - 1,
        }
    }

    pub fn clear(&mut self) {
        self.entries.fill(None);
    }

    #[inline(always)]
    pub fn probe(
        &self,
        hash_key: u64,
        remaining_depth: u8,
        alpha: i16,
        beta: i16,
    ) -> (Option<i16>, Option<String>) {
        let idx = (hash_key as usize) & self.mask;
        if let Some(entry) = &self.entries[idx] {
            if entry.hash_key == hash_key {
                let best_word = if entry.best_word_len > 0 {
                    std::str::from_utf8(&entry.best_word[..entry.best_word_len as usize])
                        .ok()
                        .map(|s| s.to_string())
                } else {
                    None
                };

                if entry.depth >= remaining_depth {
                    match entry.flag {
                        TTFlag::Exact => return (Some(entry.margin), best_word),
                        TTFlag::LowerBound if entry.margin >= beta => {
                            return (Some(entry.margin), best_word)
                        }
                        TTFlag::UpperBound if entry.margin <= alpha => {
                            return (Some(entry.margin), best_word)
                        }
                        _ => {}
                    }
                }
                return (None, best_word); // Return move for move ordering
            }
        }
        (None, None)
    }

    #[inline(always)]
    pub fn store(
        &mut self,
        hash_key: u64,
        remaining_depth: u8,
        margin: i16,
        flag: TTFlag,
        best_word: Option<&str>,
    ) {
        let idx = (hash_key as usize) & self.mask;
        let should_replace = match &self.entries[idx] {
            None => true,
            Some(existing) => {
                existing.hash_key == hash_key || remaining_depth >= existing.depth
            }
        };

        if should_replace {
            let mut word_buf = [0u8; 16];
            let mut word_len = 0u8;
            if let Some(w) = best_word {
                let bytes = w.as_bytes();
                let l = bytes.len().min(16);
                word_buf[..l].copy_from_slice(&bytes[..l]);
                word_len = l as u8;
            }

            self.entries[idx] = Some(TTEntry {
                hash_key,
                depth: remaining_depth,
                margin,
                flag,
                best_word: word_buf,
                best_word_len: word_len,
            });
        }
    }
}

pub fn calculate_rack_value(rack: &str) -> i16 {
    let mut val = 0i16;
    for ch in rack.chars() {
        if ('A'..='Z').contains(&ch) {
            val += LETTER_SCORES[(ch as u8 - b'A') as usize];
        } else if ('a'..='z').contains(&ch) {
            val += LETTER_SCORES[(ch as u8 - b'a') as usize];
        }
    }
    val
}

pub fn apply_play_to_board(board: &Board, play: &CandidatePlay, gaddag: &Gaddag) -> Board {
    let mut next_board = board.clone();
    let word_bytes = play.word.as_bytes();
    let len = word_bytes.len();

    for i in 0..len {
        let r = if play.is_vertical { play.row + i } else { play.row };
        let c = if play.is_vertical { play.col } else { play.col + i };
        let b = word_bytes[i];
        let is_blank = (b'a'..=b'z').contains(&b);
        let ch = if is_blank {
            (b - b'a' + b'A') as char
        } else {
            b as char
        };
        next_board.set_tile(r, c, ch, is_blank);
    }

    next_board.prepare_solver(gaddag);
    next_board
}

/// Solves terminal endgame using Alpha-Beta Minimax with 64-bit Zobrist Transposition Table
pub fn solve_endgame(
    board: &Board,
    player_rack: &str,
    opp_rack: &str,
    gaddag: &Gaddag,
    max_depth: usize,
) -> EndgameResult {
    let mut tt = TranspositionTable::new(18); // 262,144 entries (~8.4MB)
    let root_hash = compute_initial_hash(board, player_rack, opp_rack, true, 0);

    let mut best_play = None;
    let mut best_pv = Vec::new();
    let mut alpha = -30000i16;
    let beta = 30000i16;

    let generator = MoveGenerator::new(board, gaddag, player_rack);
    let mut plays = generator.generate_all();
    if plays.is_empty() {
        let penalty = calculate_rack_value(player_rack);
        return EndgameResult {
            best_play: None,
            terminal_margin: -penalty,
            principal_variation: vec!["PASS".to_string()],
        };
    }

    // Sort moves: going out first, then raw score descending
    plays.sort_by(|a, b| {
        let a_out = a.tiles_used as usize >= player_rack.len();
        let b_out = b.tiles_used as usize >= player_rack.len();
        if a_out != b_out {
            b_out.cmp(&a_out)
        } else {
            b.score.cmp(&a.score)
        }
    });

    let opp_rack_val = calculate_rack_value(opp_rack);
    let p_counts = rack_to_counts(player_rack);

    for play in &plays {
        let goes_out = play.tiles_used as usize >= player_rack.len();
        if goes_out {
            let out_margin = play.score + 2 * opp_rack_val;
            if out_margin > alpha {
                alpha = out_margin;
                best_play = Some(play.clone());
                best_pv = vec![format!("{} ({} pts, OUT)", play.word, play.score)];
            }
            if alpha >= beta {
                break;
            }
            continue;
        }

        let next_board = apply_play_to_board(board, play, gaddag);
        let mut sub_pv = Vec::new();

        let (child_hash, _) =
            hash_after_play(root_hash, board, play, &p_counts, true, 0);

        let margin = play.score
            - min_search(
                &next_board,
                opp_rack,
                &play.leave,
                gaddag,
                -beta + play.score,
                -alpha + play.score,
                1,
                max_depth,
                &mut sub_pv,
                child_hash,
                &mut tt,
                0,
            );

        if margin > alpha {
            alpha = margin;
            best_play = Some(play.clone());
            let mut pv = vec![format!("{} ({} pts)", play.word, play.score)];
            pv.extend(sub_pv);
            best_pv = pv;
        }

        if alpha >= beta {
            break;
        }
    }

    // Store root state in transposition table
    let flag = if alpha >= beta {
        TTFlag::LowerBound
    } else {
        TTFlag::Exact
    };
    tt.store(
        root_hash,
        max_depth as u8,
        alpha,
        flag,
        best_play.as_ref().map(|p| p.word.as_str()),
    );

    EndgameResult {
        best_play,
        terminal_margin: alpha,
        principal_variation: best_pv,
    }
}

#[allow(clippy::too_many_arguments)]
fn max_search(
    board: &Board,
    player_rack: &str,
    opp_rack: &str,
    gaddag: &Gaddag,
    mut alpha: i16,
    beta: i16,
    depth: usize,
    max_depth: usize,
    pv: &mut Vec<String>,
    current_hash: u64,
    tt: &mut TranspositionTable,
    consecutive_passes: u8,
) -> i16 {
    // 1. Terminal Check: Both players passed consecutively
    if consecutive_passes >= 2 {
        return calculate_rack_value(opp_rack) - calculate_rack_value(player_rack);
    }

    // 2. Leaf or Out Check
    if depth >= max_depth || player_rack.is_empty() {
        return calculate_rack_value(opp_rack) - calculate_rack_value(player_rack);
    }

    let remaining_depth = (max_depth.saturating_sub(depth)) as u8;

    // 3. Transposition Table Probe
    let (cached_margin, tt_best_word) = tt.probe(current_hash, remaining_depth, alpha, beta);
    if let Some(margin) = cached_margin {
        return margin;
    }

    let generator = MoveGenerator::new(board, gaddag, player_rack);
    let mut plays = generator.generate_all();

    // 4. Pass move if no plays available
    if plays.is_empty() {
        let pass_hash = hash_after_pass(current_hash, consecutive_passes);
        let mut sub_pv = Vec::new();
        let pass_margin = -min_search(
            board,
            opp_rack,
            player_rack,
            gaddag,
            -beta,
            -alpha,
            depth + 1,
            max_depth,
            &mut sub_pv,
            pass_hash,
            tt,
            consecutive_passes + 1,
        );
        pv.clear();
        pv.push("PASS".to_string());
        pv.extend(sub_pv);

        tt.store(
            current_hash,
            remaining_depth,
            pass_margin,
            TTFlag::Exact,
            Some("PASS"),
        );
        return pass_margin;
    }

    // 5. Intelligent Move Ordering:
    // (a) TT best move first
    // (b) Out-plays next
    // (c) Score descending next
    let tt_word_clone = tt_best_word;
    plays.sort_by(|a, b| {
        if let Some(ref w) = tt_word_clone {
            let a_is_tt = a.word == *w;
            let b_is_tt = b.word == *w;
            if a_is_tt != b_is_tt {
                return b_is_tt.cmp(&a_is_tt);
            }
        }
        let a_out = a.tiles_used as usize >= player_rack.len();
        let b_out = b.tiles_used as usize >= player_rack.len();
        if a_out != b_out {
            b_out.cmp(&a_out)
        } else {
            b.score.cmp(&a.score)
        }
    });

    let orig_alpha = alpha;
    let opp_rack_val = calculate_rack_value(opp_rack);
    let p_counts = rack_to_counts(player_rack);
    let mut best_word: Option<String> = None;

    // Dynamically expanded branch limit: Thanks to TT pruning, we can evaluate up to 16 moves
    let branch_limit = if depth <= 2 { 16 } else { 8 }.min(plays.len());

    for play in &plays[..branch_limit] {
        let goes_out = play.tiles_used as usize >= player_rack.len();
        if goes_out {
            let out_margin = play.score + 2 * opp_rack_val;
            if out_margin > alpha {
                alpha = out_margin;
                best_word = Some(play.word.clone());
                pv.clear();
                pv.push(format!("{} ({} pts, OUT)", play.word, play.score));
            }
            if alpha >= beta {
                tt.store(
                    current_hash,
                    remaining_depth,
                    alpha,
                    TTFlag::LowerBound,
                    best_word.as_deref(),
                );
                return alpha;
            }
            continue;
        }

        let next_board = apply_play_to_board(board, play, gaddag);
        let mut sub_pv = Vec::new();

        let (child_hash, _) =
            hash_after_play(current_hash, board, play, &p_counts, true, consecutive_passes);

        let margin = play.score
            - min_search(
                &next_board,
                opp_rack,
                &play.leave,
                gaddag,
                -beta + play.score,
                -alpha + play.score,
                depth + 1,
                max_depth,
                &mut sub_pv,
                child_hash,
                tt,
                0,
            );

        if margin > alpha {
            alpha = margin;
            best_word = Some(play.word.clone());
            pv.clear();
            pv.push(format!("{} ({} pts)", play.word, play.score));
            pv.extend(sub_pv);
        }

        if alpha >= beta {
            tt.store(
                current_hash,
                remaining_depth,
                alpha,
                TTFlag::LowerBound,
                best_word.as_deref(),
            );
            return alpha;
        }
    }

    // 6. Transposition Table Store
    let flag = if alpha <= orig_alpha {
        TTFlag::UpperBound
    } else {
        TTFlag::Exact
    };

    tt.store(
        current_hash,
        remaining_depth,
        alpha,
        flag,
        best_word.as_deref(),
    );

    alpha
}

#[allow(clippy::too_many_arguments)]
fn min_search(
    board: &Board,
    opp_rack: &str,
    player_rack: &str,
    gaddag: &Gaddag,
    alpha: i16,
    beta: i16,
    depth: usize,
    max_depth: usize,
    pv: &mut Vec<String>,
    current_hash: u64,
    tt: &mut TranspositionTable,
    consecutive_passes: u8,
) -> i16 {
    max_search(
        board,
        opp_rack,
        player_rack,
        gaddag,
        alpha,
        beta,
        depth,
        max_depth,
        pv,
        current_hash,
        tt,
        consecutive_passes,
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_transposition_table_probe_and_store() {
        let mut tt = TranspositionTable::new(10); // 1024 entries
        let hash_key = 0x1234_5678_9ABC_DEF0;

        let (val, best) = tt.probe(hash_key, 4, -100, 100);
        assert!(val.is_none());
        assert!(best.is_none());

        tt.store(hash_key, 4, 42, TTFlag::Exact, Some("QI"));

        let (val, best) = tt.probe(hash_key, 4, -100, 100);
        assert_eq!(val, Some(42));
        assert_eq!(best, Some("QI".to_string()));

        // Probing with higher remaining depth requirement returns move for ordering
        let (val_deep, best_deep) = tt.probe(hash_key, 6, -100, 100);
        assert!(val_deep.is_none());
        assert_eq!(best_deep, Some("QI".to_string()));
    }

    #[test]
    fn test_terminal_endgame_outplay() {
        let bytes = include_bytes!("../data/gaddag_twl06.bin");
        let gaddag = Gaddag::from_le_bytes(bytes);

        let mut board = Board::new();
        // Setup board with an open spot to hook "QI"
        board.set_tile(7, 7, 'I', false);
        board.prepare_solver(&gaddag);

        // Player holds 'Q', opponent holds 'Z' (value 10)
        let player_rack = "Q";
        let opp_rack = "Z";

        let result = solve_endgame(&board, player_rack, opp_rack, &gaddag, 4);

        assert!(result.best_play.is_some(), "Should find an out-play");
        let play = result.best_play.unwrap();

        println!(
            "\nEndgame Result: Best Play = {} for {} pts | Margin = {} pts | PV = {:?}",
            play.word, play.score, result.terminal_margin, result.principal_variation
        );

        // QI scores at least 11 + 2 * 10 (opponent Z) = 31 pts net margin
        assert!(result.terminal_margin >= 31);
        assert!(play.word.contains('Q'));
    }

    #[test]
    fn test_endgame_with_transposition_caching() {
        let bytes = include_bytes!("../data/gaddag_twl06.bin");
        let gaddag = Gaddag::from_le_bytes(bytes);

        let mut board = Board::new();
        board.set_tile(7, 7, 'A', false);
        board.prepare_solver(&gaddag);

        // Two multi-tile racks in endgame
        let player_rack = "AT";
        let opp_rack = "IN";

        let result = solve_endgame(&board, player_rack, opp_rack, &gaddag, 4);
        assert!(result.best_play.is_some());
        assert!(!result.principal_variation.is_empty());
        println!(
            "Multi-tile Endgame: Margin = {} | PV = {:?}",
            result.terminal_margin, result.principal_variation
        );
    }
}
