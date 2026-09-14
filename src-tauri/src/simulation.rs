// src-tauri/src/simulation.rs - Parallel Rayon Monte Carlo Opponent Retaliation Simulator with Bayesian Weighting & Multi-Ply Rollouts

use crate::bingo::FastPrng;
use crate::board::Board;
use crate::gaddag::Gaddag;
use crate::generator::{CandidatePlay, FastMoveScanner};
use rayon::prelude::*;
use std::sync::atomic::{AtomicU64, Ordering};

pub static ACTIVE_SOLVE_ID: AtomicU64 = AtomicU64::new(0);

pub fn cancel_current_solve() {
    ACTIVE_SOLVE_ID.fetch_add(1, Ordering::SeqCst);
}

pub fn next_solve_id() -> u64 {
    ACTIVE_SOLVE_ID.fetch_add(1, Ordering::SeqCst) + 1
}

pub fn is_solve_cancelled(solve_id: u64) -> bool {
    if solve_id == 0 {
        return false;
    }
    ACTIVE_SOLVE_ID.load(Ordering::Relaxed) != solve_id
}

#[derive(Debug, Clone)]
pub struct SimulationResult {
    pub best_reply: Option<String>,
    pub best_score: i16,
    pub expected_score: f32,
    pub win_prob: f32,
    pub net_margin: f32,
}

pub fn compute_position_hash(board: &Board, rack: &str) -> u32 {
    let mut h = 0x811c9dc5u32;
    for &t in &board.tiles {
        h ^= t as u32;
        h = h.wrapping_mul(0x01000193);
    }
    for b in rack.bytes() {
        h ^= b as u32;
        h = h.wrapping_mul(0x01000193);
    }
    h
}

pub fn simulate_opponent_replies(
    board: &Board,
    play: &CandidatePlay,
    gaddag: &Gaddag,
    unseen_counts: &[u8; 27],
    weights: &[f32; 27],
    samples: usize,
    base_seed: u32,
    score_differential: i16,
    multi_ply: bool,
    solve_id: u64,
) -> SimulationResult {
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

    let mut unseen_bag = Vec::with_capacity(100);
    for code in 0..27u8 {
        let count = unseen_counts[code as usize];
        for _ in 0..count {
            unseen_bag.push(code);
        }
    }

    if unseen_bag.is_empty() {
        let final_margin = play.score as f32;
        let final_diff = score_differential as f32 + final_margin;
        let win_prob = if final_diff > 0.0 {
            100.0
        } else if final_diff == 0.0 {
            50.0
        } else {
            0.0
        };
        return SimulationResult {
            best_reply: None,
            best_score: 0,
            expected_score: 0.0,
            win_prob,
            net_margin: final_margin,
        };
    }

    let sample_count = samples.max(5);

    // Results tuple: (Option<reply_word>, opp_score, trial_margin, win_point)
    let results: Vec<(Option<String>, i16, i32, f32)> = (0..sample_count)
        .into_par_iter()
        .map(|idx| {
            if is_solve_cancelled(solve_id) {
                return (None, 0i16, 0i32, 0.0f32);
            }
            let sample_seed = base_seed.wrapping_add((idx as u32).wrapping_mul(0x9E3779B9));
            let mut prng = FastPrng::new(sample_seed);

            let mut sim_bag = unseen_bag.clone();
            let draw_target = 7.min(sim_bag.len());
            let mut opp_rack_str = String::with_capacity(draw_target);

            let mut collected = 0;
            let mut attempts = 0;

            while collected < draw_target && attempts < 50 && !sim_bag.is_empty() {
                attempts += 1;
                let offset = prng.next_range(sim_bag.len());
                let tile = sim_bag[offset];
                let weight = weights[tile as usize];

                // Bayesian accept/reject sampling based on tile probability
                if weight >= 1.0 || prng.next_f32() <= weight {
                    sim_bag.swap_remove(offset);
                    if tile == 26 {
                        opp_rack_str.push('?');
                    } else {
                        opp_rack_str.push((b'A' + tile) as char);
                    }
                    collected += 1;
                }
            }

            // If strict rejection starved draw, fill remaining directly
            while opp_rack_str.len() < draw_target && !sim_bag.is_empty() {
                let offset = prng.next_range(sim_bag.len());
                let tile = sim_bag.swap_remove(offset);
                if tile == 26 {
                    opp_rack_str.push('?');
                } else {
                    opp_rack_str.push((b'A' + tile) as char);
                }
            }

            let best_opp_play = FastMoveScanner::find_best_play(&next_board, gaddag, &opp_rack_str);

            let (opp_reply, opp_score) = match best_opp_play {
                Some(ref best) => (Some(best.word.clone()), best.score),
                None => (None, 0i16),
            };

            let trial_margin: i32;
            if multi_ply {
                // Playout Turn 2: Opponent commits best move onto turn2_board
                let mut turn2_board = next_board.clone();
                if let Some(ref best) = best_opp_play {
                    let opp_bytes = best.word.as_bytes();
                    for j in 0..opp_bytes.len() {
                        let r = if best.is_vertical { best.row + j } else { best.row };
                        let c = if best.is_vertical { best.col } else { best.col + j };
                        if turn2_board.tiles[r * 15 + c] == 0 {
                            let b = opp_bytes[j];
                            let is_b = (b'a'..=b'z').contains(&b);
                            let ch = if is_b { (b - b'a' + b'A') as char } else { b as char };
                            turn2_board.set_tile(r, c, ch, is_b);
                        }
                    }
                    turn2_board.prepare_solver(gaddag);
                }

                // Player draws from remaining sim_bag to replenish rack to 7
                let mut player_rack = if play.leave == "None" {
                    String::new()
                } else {
                    play.leave.clone()
                };

                let p_needed = 7usize.saturating_sub(player_rack.len()).min(sim_bag.len());
                for _ in 0..p_needed {
                    let offset = prng.next_range(sim_bag.len());
                    let tile = sim_bag.swap_remove(offset);
                    if tile == 26 {
                        player_rack.push('?');
                    } else {
                        player_rack.push((b'A' + tile) as char);
                    }
                }

                // Player evaluates follow-up response (Ply 2) with zero-allocation find_max_score
                let p2_score = FastMoveScanner::find_max_score(&turn2_board, gaddag, &player_rack);

                // 2-turn spread margin: (player turn 1 + player turn 2) - opponent reply
                trial_margin = (play.score as i32 + p2_score as i32) - (opp_score as i32);
            } else {
                // 1-ply fast rollout
                trial_margin = (play.score as i32) - (opp_score as i32);
            }

            // Win condition against active match score differential
            let net_lead = score_differential as i32 + trial_margin;
            let win_point = if net_lead > 0 {
                1.0f32
            } else if net_lead == 0 {
                0.5f32
            } else {
                0.0f32
            };

            (opp_reply, opp_score, trial_margin, win_point)
        })
        .collect();

    let mut total_opp_score = 0i32;
    let mut max_opp_score = 0i16;
    let mut max_reply = None;
    let mut total_spread = 0i64;
    let mut total_win_pts = 0.0f32;

    for (reply, score, margin, win_pt) in results {
        total_opp_score += score as i32;
        if score > max_opp_score {
            max_opp_score = score;
            max_reply = reply;
        }
        total_spread += margin as i64;
        total_win_pts += win_pt;
    }

    let expected_opp = (total_opp_score as f32) / (sample_count as f32);
    let net_margin = (total_spread as f32) / (sample_count as f32);
    let win_prob = (total_win_pts / (sample_count as f32)) * 100.0;

    SimulationResult {
        best_reply: max_reply,
        best_score: max_opp_score,
        expected_score: (expected_opp * 10.0).round() / 10.0,
        win_prob: (win_prob * 10.0).round() / 10.0,
        net_margin: (net_margin * 10.0).round() / 10.0,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_simulate_opponent_replies_multi_ply_win_prob() {
        let board = Board::new();
        let gaddag = crate::solver::get_gaddag();
        let play = CandidatePlay {
            word: "HELLO".to_string(),
            row: 7,
            col: 7,
            is_vertical: false,
            score: 24,
            tiles_used: 5,
            is_bingo: false,
            leave: "ER".to_string(),
            leave_equity: 5.0,
            total_val: 29.0,
            bingo_prob_next_turn: 20.0,
            bingo_runway_score: 10.0,
            opp_best_reply: None,
            opp_best_score: 0,
            expected_opp_score: 0.0,
            exposes_3w: false,
            opens_triple_triple: false,
            opens_double_double: false,
            blocks_triple_triple: false,
            blocks_double_double: false,
            retains_blank: false,
            blank_surcharge_applied: false,
            is_deterministic_opponent: false,
            is_endgame_setup: false,
            is_endgame_bait: false,
            vc_ratio: "1V/1C".to_string(),
            rack_balance_tag: "BALANCED".to_string(),
            rack_balance_desc: "Normal".to_string(),
            is_exchange: false,
            win_prob: 50.0,
            net_margin: 0.0,
        };

        let mut unseen_counts = [0u8; 27];
        for i in 0..26 {
            unseen_counts[i] = 2;
        }
        let weights = [1.0f32; 27];

        // Ahead by +100 points
        let res_ahead = simulate_opponent_replies(
            &board,
            &play,
            &gaddag,
            &unseen_counts,
            &weights,
            10,
            42,
            100,
            true,
            0,
        );
        assert_eq!(res_ahead.win_prob, 100.0);
        assert!(res_ahead.net_margin >= 0.0);

        // Behind by -200 points
        let res_behind = simulate_opponent_replies(
            &board,
            &play,
            &gaddag,
            &unseen_counts,
            &weights,
            10,
            42,
            -200,
            true,
            0,
        );
        assert_eq!(res_behind.win_prob, 0.0);
    }

    #[test]
    fn test_solve_cancellation() {
        let id1 = next_solve_id();
        assert!(!is_solve_cancelled(id1));

        // Cancelling should increment the global token
        cancel_current_solve();
        assert!(is_solve_cancelled(id1));

        let id2 = next_solve_id();
        assert!(!is_solve_cancelled(id2));
        assert!(is_solve_cancelled(id1));
    }
}
