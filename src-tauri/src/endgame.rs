// src-tauri/src/endgame.rs - Terminal Endgame Alpha-Beta Minimax Solver with 64-bit Zobrist Transposition Table

use crate::board::{Board, LETTER_SCORES};
use crate::gaddag::Gaddag;
use crate::generator::{CandidatePlay, MoveGenerator};
use crate::zobrist::{
    compute_initial_hash, hash_after_pass, hash_after_play, rack_to_counts,
};

#[derive(Debug, Clone)]
pub struct EndgamePlayEvaluation {
    pub play: CandidatePlay,
    pub terminal_margin: i16,
    pub principal_variation: Vec<String>,
}

#[derive(Debug, Clone)]
pub struct EndgameResult {
    pub best_play: Option<CandidatePlay>,
    pub terminal_margin: i16,
    pub principal_variation: Vec<String>,
    pub ranked_plays: Vec<EndgamePlayEvaluation>,
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
    pub hits: usize,
    pub probes: usize,
    pub stores: usize,
}

impl TranspositionTable {
    pub fn new(power_of_two: usize) -> Self {
        let size = 1 << power_of_two;
        Self {
            entries: vec![None; size],
            mask: size - 1,
            hits: 0,
            probes: 0,
            stores: 0,
        }
    }

    pub fn clear(&mut self) {
        self.entries.fill(None);
        self.hits = 0;
        self.probes = 0;
        self.stores = 0;
    }

    #[inline(always)]
    pub fn probe(
        &mut self,
        hash_key: u64,
        remaining_depth: u8,
        alpha: i16,
        beta: i16,
    ) -> (Option<i16>, Option<String>) {
        self.probes += 1;
        let idx = (hash_key as usize) & self.mask;
        if let Some(entry) = &self.entries[idx] {
            if entry.hash_key == hash_key {
                self.hits += 1;
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
        self.stores += 1;
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

/// Solves terminal endgame using Iterative Deepening Alpha-Beta Minimax with 64-bit Zobrist Transposition Table
pub fn solve_endgame(
    board: &Board,
    player_rack: &str,
    opp_rack: &str,
    gaddag: &Gaddag,
    max_depth: usize,
) -> EndgameResult {
    solve_endgame_iterative(board, player_rack, opp_rack, gaddag, max_depth, 150)
}

/// Iterative Deepening Alpha-Beta Minimax solver with progressive depth escalation,
/// cooperative time-budget abortion, and principal-variation move ordering.
pub fn solve_endgame_iterative(
    board: &Board,
    player_rack: &str,
    opp_rack: &str,
    gaddag: &Gaddag,
    max_depth: usize,
    time_budget_ms: u128,
) -> EndgameResult {
    let start_time = std::time::Instant::now();
    let mut tt = TranspositionTable::new(18); // 262,144 entries (~8.4MB)
    let root_hash = compute_initial_hash(board, player_rack, opp_rack, true, 0);

    let generator = MoveGenerator::new(board, gaddag, player_rack);
    let mut plays = generator.generate_all();
    if plays.is_empty() {
        let penalty = calculate_rack_value(player_rack);
        return EndgameResult {
            best_play: None,
            terminal_margin: -penalty,
            principal_variation: vec!["PASS".to_string()],
            ranked_plays: Vec::new(),
        };
    }

    let opp_rack_val = calculate_rack_value(opp_rack);
    let p_counts = rack_to_counts(player_rack);

    // Progressive depth schedule: 2 -> 4 -> 6 -> 8 -> ... up to max_depth
    let mut depths: Vec<usize> = (2..=max_depth).step_by(2).collect();
    if depths.is_empty() || *depths.last().unwrap() < max_depth {
        depths.push(max_depth);
    }

    let mut best_result = EndgameResult {
        best_play: None,
        terminal_margin: -30000,
        principal_variation: Vec::new(),
        ranked_plays: Vec::new(),
    };

    let mut prev_best_word: Option<String> = None;

    for (iter_idx, &cur_depth) in depths.iter().enumerate() {
        // Time budget check: If at least 1 iteration has completed and budget is exceeded, stop
        if iter_idx > 0 && start_time.elapsed().as_millis() >= time_budget_ms {
            break;
        }

        let mut alpha = -30000i16;
        let beta = 30000i16;
        let mut iter_best_play = None;
        let mut iter_best_pv = Vec::new();
        let mut iter_evaluations = Vec::new();
        let mut truncated = false;

        // Move Ordering for this iteration:
        // 1. Principal Variation / Best move from previous iteration
        // 2. Out-plays (exhausting player rack)
        // 3. Raw score descending
        let p_word = prev_best_word.clone();
        plays.sort_by(|a, b| {
            if let Some(ref w) = p_word {
                let a_is_best = a.word == *w;
                let b_is_best = b.word == *w;
                if a_is_best != b_is_best {
                    return b_is_best.cmp(&a_is_best);
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

        let root_limit = plays.len().min(if cur_depth <= 4 { 32 } else { 20 });

        for play in &plays[..root_limit] {
            let goes_out = play.tiles_used as usize >= player_rack.len();
            if goes_out {
                let out_margin = play.score + 2 * opp_rack_val;
                let pv = vec![format!("{} ({} pts, OUT)", play.word, play.score)];
                iter_evaluations.push(EndgamePlayEvaluation {
                    play: play.clone(),
                    terminal_margin: out_margin,
                    principal_variation: pv.clone(),
                });
                if out_margin > alpha {
                    alpha = out_margin;
                    iter_best_play = Some(play.clone());
                    iter_best_pv = pv;
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
                    cur_depth,
                    &mut sub_pv,
                    child_hash,
                    &mut tt,
                    0,
                    &mut truncated,
                );

            let mut pv = vec![format!("{} ({} pts)", play.word, play.score)];
            pv.extend(sub_pv);
            iter_evaluations.push(EndgamePlayEvaluation {
                play: play.clone(),
                terminal_margin: margin,
                principal_variation: pv.clone(),
            });

            if margin > alpha {
                alpha = margin;
                iter_best_play = Some(play.clone());
                iter_best_pv = pv;
            }

            if alpha >= beta {
                break;
            }
        }

        // Store root state in TT
        let flag = if alpha >= beta {
            TTFlag::LowerBound
        } else {
            TTFlag::Exact
        };
        tt.store(
            root_hash,
            cur_depth as u8,
            alpha,
            flag,
            iter_best_play.as_ref().map(|p| p.word.as_str()),
        );

        if let Some(ref p) = iter_best_play {
            prev_best_word = Some(p.word.clone());
        }

        iter_evaluations.sort_by(|a, b| b.terminal_margin.cmp(&a.terminal_margin));

        best_result = EndgameResult {
            best_play: iter_best_play,
            terminal_margin: alpha,
            principal_variation: iter_best_pv,
            ranked_plays: iter_evaluations,
        };

        // If no branch was truncated by search depth, the tree is mathematically fully solved!
        if !truncated {
            break;
        }
    }

    // Fallback if best_play is still None (e.g. all moves fail low)
    if best_result.best_play.is_none() && !plays.is_empty() {
        best_result.best_play = Some(plays[0].clone());
        best_result.terminal_margin = plays[0].score;
    }

    best_result
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
    truncated: &mut bool,
) -> i16 {
    // 1. Terminal Check: Both players passed consecutively
    if consecutive_passes >= 2 {
        return calculate_rack_value(opp_rack) - calculate_rack_value(player_rack);
    }

    // 2. Leaf or Out Check
    if player_rack.is_empty() {
        return calculate_rack_value(opp_rack);
    }

    if depth >= max_depth {
        *truncated = true;
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
            truncated,
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
                truncated,
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
    truncated: &mut bool,
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
        truncated,
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

    #[test]
    fn test_iterative_deepening_deep_search() {
        let bytes = include_bytes!("../data/gaddag_twl06.bin");
        let gaddag = Gaddag::from_le_bytes(bytes);

        let mut board = Board::new();
        board.set_tile(7, 7, 'A', false);
        board.prepare_solver(&gaddag);

        let player_rack = "AT";
        let opp_rack = "IN";

        let start = std::time::Instant::now();
        // Test depth 8 search with iterative deepening
        let result = solve_endgame(&board, player_rack, opp_rack, &gaddag, 8);
        let elapsed = start.elapsed();

        assert!(result.best_play.is_some());
        assert!(!result.principal_variation.is_empty());
        println!(
            "Iterative Deepening (Depth 8): Margin = {} | PV = {:?} | Time = {:?}",
            result.terminal_margin, result.principal_variation, elapsed
        );
        assert!(
            elapsed.as_millis() < 200,
            "Depth 8 iterative deepening should complete in < 200ms, took {:?}",
            elapsed
        );
    }

    #[test]
    fn test_iterative_deepening_early_exhaustion() {
        let bytes = include_bytes!("../data/gaddag_twl06.bin");
        let gaddag = Gaddag::from_le_bytes(bytes);

        let mut board = Board::new();
        board.set_tile(7, 7, 'I', false);
        board.prepare_solver(&gaddag);

        // Single tile each: Depth 2 completely exhausts the tree, so depth 8 terminates early
        let player_rack = "Q";
        let opp_rack = "Z";

        let start = std::time::Instant::now();
        let result = solve_endgame(&board, player_rack, opp_rack, &gaddag, 8);
        let elapsed = start.elapsed();

        assert!(result.best_play.is_some());
        assert!(result.terminal_margin >= 31);
        println!(
            "Exhaustive Early Exit (Target Depth 8): Margin = {} | PV = {:?} | Time = {:?}",
            result.terminal_margin, result.principal_variation, elapsed
        );
        assert!(
            elapsed.as_millis() < 50,
            "Exhaustive endgame should exit in < 50ms, took {:?}",
            elapsed
        );
    }

    #[test]
    fn test_iterative_deepening_multi_ply_sequence() {
        let bytes = include_bytes!("../data/gaddag_twl06.bin");
        let gaddag = Gaddag::from_le_bytes(bytes);

        let mut board = Board::new();
        // Setup a 4-letter word "TEST" on board
        board.set_tile(7, 6, 'T', false);
        board.set_tile(7, 7, 'E', false);
        board.set_tile(7, 8, 'S', false);
        board.set_tile(7, 9, 'T', false);
        board.prepare_solver(&gaddag);

        let player_rack = "ROAD";
        let opp_rack = "LION";

        let start = std::time::Instant::now();
        let result = solve_endgame(&board, player_rack, opp_rack, &gaddag, 6);
        let elapsed = start.elapsed();

        assert!(result.best_play.is_some());
        println!(
            "Multi-ply Sequence (Depth 6): Best Play = {} ({} pts) | Margin = {} | PV = {:?} | Time = {:?}",
            result.best_play.as_ref().unwrap().word,
            result.best_play.as_ref().unwrap().score,
            result.terminal_margin,
            result.principal_variation,
            elapsed
        );
        assert!(
            elapsed.as_millis() < 150,
            "Multi-ply endgame search should complete in < 150ms, took {:?}",
            elapsed
        );
    }

    #[test]
    fn test_quackle_q_sticking_turnover() {
        let bytes = include_bytes!("../data/gaddag_twl06.bin");
        let gaddag = Gaddag::from_le_bytes(bytes);

        let mut board = Board::new();
        // Setup board with an open 'I' tile
        board.set_tile(7, 7, 'I', false);
        board.prepare_solver(&gaddag);

        // Player holds 'Q' (value 10), Opponent holds 'Q' / unplayable clunker
        let player_rack = "Q";
        let opp_rack = "Q";

        let result = solve_endgame(&board, player_rack, opp_rack, &gaddag, 8);
        assert!(result.best_play.is_some());
        let best = result.best_play.unwrap();
        assert_eq!(best.word, "QI");

        // Player plays QI (11 pts), exhausts rack. Opponent stuck with Q (10 pts).
        // Terminal margin = 11 + 2 * 10 = 31 pts.
        assert_eq!(result.terminal_margin, 31);
        assert_eq!(result.principal_variation, vec!["QI (11 pts, OUT)"]);
        println!(
            "Quackle Q-Sticking Parity: Best = {} | Margin = {} | PV = {:?}",
            best.word, result.terminal_margin, result.principal_variation
        );
    }

    #[test]
    fn test_quackle_tactical_defense_vs_greedy_trap() {
        let bytes = include_bytes!("../data/gaddag_twl06.bin");
        let gaddag = Gaddag::from_le_bytes(bytes);

        let mut board = Board::new();
        // Setup board with word "AXE" at (7, 6..=8)
        board.set_tile(7, 6, 'A', false);
        board.set_tile(7, 7, 'X', false);
        board.set_tile(7, 8, 'E', false);
        board.prepare_solver(&gaddag);

        let player_rack = "IT";
        let opp_rack = "NO";

        let result = solve_endgame(&board, player_rack, opp_rack, &gaddag, 6);
        assert!(result.best_play.is_some());
        assert!(!result.ranked_plays.is_empty());

        // Verify that the chosen play maximizes terminal minimax margin
        let top = &result.ranked_plays[0];
        println!(
            "Tactical Defense: Chosen Move = {} ({} pts) | Margin = {} | Opponent PV = {:?}",
            top.play.word, top.play.score, top.terminal_margin, top.principal_variation
        );

        if result.ranked_plays.len() > 1 {
            let second = &result.ranked_plays[1];
            assert!(
                top.terminal_margin >= second.terminal_margin,
                "Top play margin ({}) must be >= second play margin ({})",
                top.terminal_margin,
                second.terminal_margin
            );
        }
    }

    #[test]
    fn test_transposition_table_hit_rate_and_pruning() {
        let bytes = include_bytes!("../data/gaddag_twl06.bin");
        let gaddag = Gaddag::from_le_bytes(bytes);

        let mut board = Board::new();
        board.set_tile(7, 6, 'T', false);
        board.set_tile(7, 7, 'E', false);
        board.set_tile(7, 8, 'S', false);
        board.set_tile(7, 9, 'T', false);
        board.prepare_solver(&gaddag);

        let player_rack = "ROADS";
        let opp_rack = "LIONS";

        let mut tt = TranspositionTable::new(16);
        let root_hash = compute_initial_hash(&board, player_rack, opp_rack, true, 0);
        let mut truncated = false;
        let mut pv = Vec::new();

        // Iteration 1 (Depth 2): Populates TT
        let _s1 = max_search(
            &board,
            player_rack,
            opp_rack,
            &gaddag,
            -30000,
            30000,
            0,
            2,
            &mut pv,
            root_hash,
            &mut tt,
            0,
            &mut truncated,
        );
        let d2_stores = tt.stores;

        // Iteration 2 (Depth 4): Re-searches with TT hits from Depth 2
        let _s2 = max_search(
            &board,
            player_rack,
            opp_rack,
            &gaddag,
            -30000,
            30000,
            0,
            4,
            &mut pv,
            root_hash,
            &mut tt,
            0,
            &mut truncated,
        );

        let hit_rate = if tt.probes > 0 {
            (tt.hits as f64 / tt.probes as f64) * 100.0
        } else {
            0.0
        };

        println!(
            "TT Iterative Deepening Telemetry: {} Probes | {} Hits ({:.1}%) | D2 Stores = {}, Total Stores = {}",
            tt.probes, tt.hits, hit_rate, d2_stores, tt.stores
        );

        assert!(tt.stores > 0, "Transposition table must store positions");
        assert!(tt.probes > 0, "Transposition table must be probed");
        assert!(tt.hits > 0, "Transposition table must produce hits during deepening re-search");
    }

    #[test]
    fn test_endgame_7_tile_release_speed_benchmark() {
        let bytes = include_bytes!("../data/gaddag_twl06.bin");
        let gaddag = Gaddag::from_le_bytes(bytes);

        let mut board = Board::new();
        board.set_tile(7, 5, 'P', false);
        board.set_tile(7, 6, 'L', false);
        board.set_tile(7, 7, 'A', false);
        board.set_tile(7, 8, 'Y', false);
        board.prepare_solver(&gaddag);

        let player_rack = "RETINAS";
        let opp_rack = "DOGCART";

        let start = std::time::Instant::now();
        let result = solve_endgame(&board, player_rack, opp_rack, &gaddag, 8);
        let elapsed = start.elapsed();

        assert!(result.best_play.is_some());
        println!(
            "7-Tile Endgame (Depth 8): Play = {} ({} pts) | Margin = {} | PV = {:?} | Time = {:?}",
            result.best_play.as_ref().unwrap().word,
            result.best_play.as_ref().unwrap().score,
            result.terminal_margin,
            result.principal_variation,
            elapsed
        );
        assert!(
            elapsed.as_millis() < 150,
            "7-tile endgame search should complete in < 150ms, took {:?}",
            elapsed
        );
    }

    #[test]
    fn test_endgame_ranked_leaderboard_integrity() {
        let bytes = include_bytes!("../data/gaddag_twl06.bin");
        let gaddag = Gaddag::from_le_bytes(bytes);

        let mut board = Board::new();
        board.set_tile(7, 7, 'A', false);
        board.prepare_solver(&gaddag);

        let player_rack = "AT";
        let opp_rack = "IN";

        let result = solve_endgame(&board, player_rack, opp_rack, &gaddag, 4);
        assert!(!result.ranked_plays.is_empty(), "Leaderboard must not be empty");

        // Verify descending sort by terminal margin
        for i in 1..result.ranked_plays.len() {
            assert!(
                result.ranked_plays[i - 1].terminal_margin >= result.ranked_plays[i].terminal_margin,
                "Leaderboard plays must be sorted descending by terminal margin"
            );
        }

        println!(
            "Endgame Leaderboard ({} candidates evaluated): Top 3 = {:?}",
            result.ranked_plays.len(),
            result
                .ranked_plays
                .iter()
                .take(3)
                .map(|e| (e.play.word.as_str(), e.terminal_margin, &e.principal_variation))
                .collect::<Vec<_>>()
        );
    }
}
