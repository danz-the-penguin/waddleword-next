// src-tauri/src/endgame.rs - 4-to-6 Ply Alpha-Beta Terminal Endgame Minimax Solver

use crate::board::{Board, LETTER_SCORES};
use crate::gaddag::Gaddag;
use crate::generator::{CandidatePlay, MoveGenerator};

#[derive(Debug, Clone)]
pub struct EndgameResult {
    pub best_play: Option<CandidatePlay>,
    pub terminal_margin: i16,
    pub principal_variation: Vec<String>,
}

fn calculate_rack_value(rack: &str) -> i16 {
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

fn apply_play_to_board(board: &Board, play: &CandidatePlay, gaddag: &Gaddag) -> Board {
    let mut next_board = board.clone();
    let word_bytes = play.word.as_bytes();
    let len = word_bytes.len();

    for i in 0..len {
        let r = if play.is_vertical { play.row + i } else { play.row };
        let c = if play.is_vertical { play.col } else { play.col + i };
        let b = word_bytes[i];
        let is_blank = (b'a'..=b'z').contains(&b);
        let ch = if is_blank { (b - b'a' + b'A') as char } else { b as char };
        next_board.set_tile(r, c, ch, is_blank);
    }

    next_board.prepare_solver(gaddag);
    next_board
}

/// Solves terminal endgame when bag is empty and both racks are known
pub fn solve_endgame(
    board: &Board,
    player_rack: &str,
    opp_rack: &str,
    gaddag: &Gaddag,
    max_depth: usize,
) -> EndgameResult {
    let mut best_play = None;
    let mut best_pv = Vec::new();
    let mut alpha = -30000i16;
    let beta = 30000i16;

    let generator = MoveGenerator::new(board, gaddag, player_rack);
    let mut plays = generator.generate_all();
    if plays.is_empty() {
        // We have no moves: opponent plays or passes
        let penalty = calculate_rack_value(player_rack);
        return EndgameResult {
            best_play: None,
            terminal_margin: -penalty,
            principal_variation: vec!["PASS".to_string()],
        };
    }

    // Sort moves by score descending for optimal alpha-beta cutoff
    plays.sort_by(|a, b| b.score.cmp(&a.score));

    let opp_rack_val = calculate_rack_value(opp_rack);

    for play in &plays {
        let goes_out = play.tiles_used as usize >= player_rack.len();
        if goes_out {
            // Immediate win by going out: score + 2 * opponent rack value
            let out_margin = play.score + 2 * opp_rack_val;
            if out_margin > alpha {
                alpha = out_margin;
                best_play = Some(play.clone());
                best_pv = vec![format!("{} ({} pts, OUT)", play.word, play.score)];
            }
            continue;
        }

        let next_board = apply_play_to_board(board, play, gaddag);
        let mut sub_pv = Vec::new();

        let margin = play.score - min_search(
            &next_board,
            opp_rack,
            &play.leave,
            gaddag,
            -beta + play.score,
            -alpha + play.score,
            1,
            max_depth,
            &mut sub_pv,
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
) -> i16 {
    if depth >= max_depth || player_rack.is_empty() {
        return calculate_rack_value(opp_rack) - calculate_rack_value(player_rack);
    }

    let generator = MoveGenerator::new(board, gaddag, player_rack);
    let mut plays = generator.generate_all();
    if plays.is_empty() {
        // Pass
        return -calculate_rack_value(player_rack);
    }

    plays.sort_by(|a, b| b.score.cmp(&a.score));
    let opp_rack_val = calculate_rack_value(opp_rack);

    let branch_limit = if depth == 1 { 8 } else { 4 }.min(plays.len());

    for play in &plays[..branch_limit] {
        let goes_out = play.tiles_used as usize >= player_rack.len();
        if goes_out {
            let out_margin = play.score + 2 * opp_rack_val;
            if out_margin > alpha {
                alpha = out_margin;
                pv.clear();
                pv.push(format!("{} ({} pts, OUT)", play.word, play.score));
            }
            if alpha >= beta {
                return alpha;
            }
            continue;
        }

        let next_board = apply_play_to_board(board, play, gaddag);
        let mut sub_pv = Vec::new();

        let margin = play.score - min_search(
            &next_board,
            opp_rack,
            &play.leave,
            gaddag,
            -beta + play.score,
            -alpha + play.score,
            depth + 1,
            max_depth,
            &mut sub_pv,
        );

        if margin > alpha {
            alpha = margin;
            pv.clear();
            pv.push(format!("{} ({} pts)", play.word, play.score));
            pv.extend(sub_pv);
        }

        if alpha >= beta {
            return alpha;
        }
    }

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
    )
}

#[cfg(test)]
mod tests {
    use super::*;

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
}
