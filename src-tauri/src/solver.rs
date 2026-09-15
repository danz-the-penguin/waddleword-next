// src-tauri/src/solver.rs - Top-level Scrabble Engine Solver with Endgame Minimax, MCTS, and Strategy

use crate::bingo::{calculate_runway_score, forecast_bingo_probability};
use crate::board::Board;
use crate::endgame::solve_endgame;
use crate::equity::evaluate_leave_comprehensive;
use crate::gaddag::Gaddag;
use crate::generator::{CandidatePlay, MoveGenerator};
use crate::inference::{compute_inference_weights, OpponentPlayContext};
use crate::simulation::{compute_position_hash, simulate_opponent_replies};
use crate::strategy::{
    calculate_strategic_modifiers, get_retaliation_multiplier, get_runway_multiplier,
};
use rayon::prelude::*;
use std::collections::HashMap;
use std::sync::OnceLock;

static GADDAG_TWL06: OnceLock<Gaddag> = OnceLock::new();
static GADDAG_NWL2023: OnceLock<Gaddag> = OnceLock::new();
static GADDAG_CSW21: OnceLock<Gaddag> = OnceLock::new();
static GADDAG_CSW24: OnceLock<Gaddag> = OnceLock::new();
static GADDAG_SOWPODS: OnceLock<Gaddag> = OnceLock::new();
static CUSTOM_GADDAG: std::sync::RwLock<Option<&'static Gaddag>> = std::sync::RwLock::new(None);

use std::sync::atomic::{AtomicUsize, Ordering};
static WORKER_THREADS: AtomicUsize = AtomicUsize::new(8);

pub fn get_worker_threads() -> usize {
    WORKER_THREADS.load(Ordering::Relaxed)
}

pub fn set_worker_threads(threads: usize) -> usize {
    let bounded = threads.clamp(1, 16);
    WORKER_THREADS.store(bounded, Ordering::Relaxed);
    bounded
}

pub fn set_custom_gaddag(gaddag: Gaddag) {
    let leaked: &'static Gaddag = Box::leak(Box::new(gaddag));
    let mut lock = CUSTOM_GADDAG.write().unwrap();
    *lock = Some(leaked);
}

pub fn has_custom_gaddag() -> bool {
    CUSTOM_GADDAG.read().unwrap().is_some()
}

pub const STANDARD_DISTRIBUTION: [u8; 27] = [
    9, 2, 2, 4, 12, 2, 3, 2, 9, 1, 1, 4, 2, 6, 8, 2, 1, 6, 4, 6, 4, 2, 2, 1, 2, 1, 2,
];

pub fn get_gaddag_for_lexicon(lexicon: &str) -> &'static Gaddag {
    match lexicon.to_lowercase().as_str() {
        "custom" => {
            if let Some(g) = *CUSTOM_GADDAG.read().unwrap() {
                g
            } else {
                GADDAG_TWL06.get_or_init(|| {
                    Gaddag::from_le_bytes(include_bytes!("../data/gaddag_twl06.bin"))
                })
            }
        }
        "nwl2023" | "nwl" => GADDAG_NWL2023.get_or_init(|| {
            Gaddag::from_le_bytes(include_bytes!("../data/gaddag_nwl2023.bin"))
        }),
        "csw21" => GADDAG_CSW21.get_or_init(|| {
            Gaddag::from_le_bytes(include_bytes!("../data/gaddag_csw21.bin"))
        }),
        "csw24" | "csw" => GADDAG_CSW24.get_or_init(|| {
            Gaddag::from_le_bytes(include_bytes!("../data/gaddag_csw24.bin"))
        }),
        "sowpods" => GADDAG_SOWPODS.get_or_init(|| {
            Gaddag::from_le_bytes(include_bytes!("../data/gaddag_sowpods.bin"))
        }),
        _ => GADDAG_TWL06.get_or_init(|| {
            Gaddag::from_le_bytes(include_bytes!("../data/gaddag_twl06.bin"))
        }),
    }
}

pub fn get_gaddag() -> &'static Gaddag {
    get_gaddag_for_lexicon("twl06")
}

pub fn compute_unseen_counts(board: &Board, rack: &str) -> [u8; 27] {
    let mut unseen = STANDARD_DISTRIBUTION;

    for i in 0..225 {
        let t = board.tiles[i];
        if t != 0 {
            if board.is_blank[i] {
                if unseen[26] > 0 {
                    unseen[26] -= 1;
                }
            } else {
                let code = (t - 1) as usize;
                if unseen[code] > 0 {
                    unseen[code] -= 1;
                }
            }
        }
    }

    for ch in rack.chars() {
        if ch == '?' {
            if unseen[26] > 0 {
                unseen[26] -= 1;
            }
        } else if ('a'..='z').contains(&ch) {
            let code = (ch as u8 - b'a') as usize;
            if unseen[code] > 0 {
                unseen[code] -= 1;
            }
        } else if ('A'..='Z').contains(&ch) {
            let code = (ch as u8 - b'A') as usize;
            if unseen[code] > 0 {
                unseen[code] -= 1;
            }
        }
    }

    unseen
}

pub use crate::simulation::cancel_current_solve;

pub fn solve_advanced(
    mut board: Board,
    rack: &str,
    sort_mode: &str,
    score_differential: i16,
    bag_count: Option<u8>,
    last_opp_context: Option<&OpponentPlayContext>,
    manual_available_tiles: Option<&str>,
    lexicon: Option<&str>,
    equity_mode: Option<&str>,
    sim_quality: Option<&str>,
    solve_id: Option<u64>,
) -> Vec<CandidatePlay> {
    let effective_solve_id = solve_id.unwrap_or(0);
    let gaddag = get_gaddag_for_lexicon(lexicon.unwrap_or("twl06"));
    board.prepare_solver(gaddag);

    let unseen_counts = if let Some(manual) = manual_available_tiles {
        if !manual.trim().is_empty() {
            let mut counts = [0u8; 27];
            for ch in manual.chars() {
                if ch == '?' {
                    counts[26] = counts[26].saturating_add(1);
                } else if ch.is_ascii_alphabetic() {
                    let code = (ch.to_ascii_uppercase() as u8) - b'A';
                    if (code as usize) < 26 {
                        counts[code as usize] = counts[code as usize].saturating_add(1);
                    }
                }
            }
            counts
        } else {
            compute_unseen_counts(&board, rack)
        }
    } else {
        compute_unseen_counts(&board, rack)
    };

    let total_unseen: usize = unseen_counts.iter().map(|&c| c as usize).sum();

    // 1. True Terminal Endgame: Bag is empty (bag_count == 0 or total_unseen <= 7)
    let is_true_endgame = bag_count == Some(0) || total_unseen <= 7;
    if is_true_endgame && total_unseen > 0 {
        let mut opp_rack = String::new();
        for code in 0..26u8 {
            for _ in 0..unseen_counts[code as usize] {
                opp_rack.push((b'A' + code) as char);
            }
        }
        for _ in 0..unseen_counts[26] {
            opp_rack.push('?');
        }

        let endgame_res = solve_endgame(&board, rack, &opp_rack, gaddag, 8);

        if !endgame_res.ranked_plays.is_empty() {
            let mut results = Vec::new();
            for eval in endgame_res.ranked_plays {
                let mut p = eval.play;
                p.total_val = eval.terminal_margin as f32;
                p.net_margin = eval.terminal_margin as f32;
                p.is_deterministic_opponent = true;
                p.opp_best_reply = if !eval.principal_variation.is_empty() {
                    Some(eval.principal_variation.join(" -> "))
                } else {
                    None
                };
                p.opp_best_score = 0;
                p.vc_ratio = "0V/0C".to_string();
                p.rack_balance_tag = "endgame".to_string();
                p.rack_balance_desc = "Terminal Endgame Sequence".to_string();
                p.is_exchange = false;
                results.push(p);
            }
            return results;
        } else if let Some(mut top_play) = endgame_res.best_play {
            top_play.total_val = endgame_res.terminal_margin as f32;
            top_play.net_margin = endgame_res.terminal_margin as f32;
            top_play.is_deterministic_opponent = true;
            top_play.opp_best_reply = if !endgame_res.principal_variation.is_empty() {
                Some(endgame_res.principal_variation.join(" -> "))
            } else {
                None
            };
            top_play.opp_best_score = 0;
            top_play.vc_ratio = "0V/0C".to_string();
            top_play.rack_balance_tag = "endgame".to_string();
            top_play.rack_balance_desc = "Terminal Endgame Sequence".to_string();
            top_play.is_exchange = false;
            return vec![top_play];
        }
    }

    // 2. Midgame / Pre-Endgame Standard Search
    let generator = MoveGenerator::new(&board, gaddag, rack);
    let mut plays = generator.generate_all();
    if plays.is_empty() {
        return plays;
    }

    let runway = calculate_runway_score(&board);
    let retaliation_mult = get_retaliation_multiplier(score_differential);
    let runway_mult = get_runway_multiplier(score_differential);
    let base_position_hash = compute_position_hash(&board, rack);
    let is_deterministic = is_true_endgame;
    let inference_weights = compute_inference_weights(last_opp_context);

    // 3. Initial Heuristic Evaluation & Memoized Bingo Forecasting
    let mut leave_cache: HashMap<String, f32> = HashMap::with_capacity(64);
    let mut hash_counter = 0u32;

    for p in &mut plays {
        p.is_deterministic_opponent = is_deterministic;
        let (eq, balance) = evaluate_leave_comprehensive(&p.leave, equity_mode.unwrap_or("trained"));
        p.leave_equity = eq;
        p.vc_ratio = balance.vc_ratio;
        p.rack_balance_tag = balance.tag;
        p.rack_balance_desc = balance.description;
        p.bingo_runway_score = runway;

        let prob = *leave_cache.entry(p.leave.clone()).or_insert_with(|| {
            hash_counter = hash_counter.wrapping_add(31);
            let seed = base_position_hash.wrapping_add(hash_counter);
            forecast_bingo_probability(&p.leave, &unseen_counts, gaddag, 30, seed)
        });
        p.bingo_prob_next_turn = prob;

        let bag_bonus = calculate_strategic_modifiers(score_differential, bag_count, p.tiles_used);
        let bingo_boost = p.bingo_prob_next_turn * 0.12;

        let mut tactical_adj = 0.0f32;
        if p.exposes_3w { tactical_adj -= 3.0; }
        if p.opens_triple_triple { tactical_adj -= 3.5; }
        if p.opens_double_double { tactical_adj -= 1.2; }
        if p.blocks_triple_triple { tactical_adj += 2.0; }
        if p.blocks_double_double { tactical_adj += 1.0; }
        if p.retains_blank { tactical_adj += 1.5; }
        if p.blank_surcharge_applied { tactical_adj -= 1.5; }

        // Pre-Endgame Lookahead & Bag Depletion (Bag <= 14)
        if let Some(bag) = bag_count {
            if bag >= 1 && bag <= 14 {
                if p.tiles_used >= bag {
                    p.is_endgame_setup = true;
                    if score_differential >= 0 {
                        tactical_adj += 5.0; // Seizes terminal endgame control
                    }
                } else if bag.saturating_sub(p.tiles_used) <= 3 && bag.saturating_sub(p.tiles_used) >= 1 && score_differential <= 15 {
                    p.is_endgame_bait = true;
                    tactical_adj -= 3.0; // Leaves 1-3 tiles in bag for opponent to grab with full knowledge
                }
                if bag <= 8 && p.retains_blank {
                    tactical_adj += 2.5; // Blank preservation in late pre-endgame
                }
            }
        }

        p.total_val = ((p.score as f32 + eq + bingo_boost + runway * runway_mult + bag_bonus + tactical_adj) * 10.0).round() / 10.0;
    }

    // Sort by provisional strategic value to identify top candidates for parallel MCTS
    plays.sort_by(|a, b| b.total_val.partial_cmp(&a.total_val).unwrap_or(std::cmp::Ordering::Equal));

    let (sim_cutoff_limit, sample_count, multi_ply) = match sim_quality.unwrap_or("standard").to_lowercase().as_str() {
        "beginnerbot" | "blitz" => (10, 12, false),
        "basicbot" => (12, 20, false),
        "betterbot" | "standard" => (15, 40, true),
        "steebot" | "deep" => (20, 120, true),
        "hastybot" | "championship" | "championship_m1" => (25, 300, true),
        _ => (15, 40, true),
    };
    let sim_cutoff = sim_cutoff_limit.min(plays.len());

    // Fill analytical win probability and margin estimates for candidate plays beyond the simulation cutoff
    for play in plays.iter_mut().skip(sim_cutoff) {
        let est_margin = (play.score as f32) + play.leave_equity - 22.0;
        let eff_diff = score_differential as f32 + est_margin;
        let win_prob = (1.0 / (1.0 + (-eff_diff / 28.0).exp())) * 100.0;
        play.net_margin = (est_margin * 10.0).round() / 10.0;
        play.win_prob = (win_prob * 10.0).round() / 10.0;
    }

    plays[0..sim_cutoff]
        .par_iter_mut()
        .enumerate()
        .for_each(|(i, play)| {
            if crate::simulation::is_solve_cancelled(effective_solve_id) {
                return;
            }
            let seed = base_position_hash ^ ((i as u32) << 16);
            let sim = simulate_opponent_replies(
                &board,
                play,
                gaddag,
                &unseen_counts,
                &inference_weights,
                sample_count,
                seed,
                score_differential,
                multi_ply,
                effective_solve_id,
            );

            if crate::simulation::is_solve_cancelled(effective_solve_id) {
                return;
            }

            play.opp_best_reply = sim.best_reply;
            play.opp_best_score = sim.best_score;
            play.expected_opp_score = sim.expected_score;
            play.win_prob = sim.win_prob;
            play.net_margin = sim.net_margin;

            let bag_bonus = calculate_strategic_modifiers(score_differential, bag_count, play.tiles_used);

            let mut tactical_adj = 0.0f32;
            if play.exposes_3w { tactical_adj -= 3.0; }
            if play.opens_triple_triple { tactical_adj -= 3.5; }
            if play.opens_double_double { tactical_adj -= 1.2; }
            if play.blocks_triple_triple { tactical_adj += 2.0; }
            if play.blocks_double_double { tactical_adj += 1.0; }
            if play.retains_blank { tactical_adj += 1.5; }
            if play.blank_surcharge_applied { tactical_adj -= 1.5; }

            // Pre-Endgame Lookahead & Bag Depletion (Bag <= 14)
            if let Some(bag) = bag_count {
                if bag >= 1 && bag <= 14 {
                    if play.tiles_used >= bag {
                        play.is_endgame_setup = true;
                        if score_differential >= 0 {
                            tactical_adj += 5.0;
                        }
                    } else if bag.saturating_sub(play.tiles_used) <= 3 && bag.saturating_sub(play.tiles_used) >= 1 && score_differential <= 15 {
                        play.is_endgame_bait = true;
                        tactical_adj -= 3.0;
                    }
                    if bag <= 8 && play.retains_blank {
                        tactical_adj += 2.5;
                    }
                }
            }

            // Final Calibrated Strategic Value
            let mut final_val = (play.score as f32)
                + play.leave_equity
                + (play.bingo_prob_next_turn * 0.15)
                + (play.bingo_runway_score * runway_mult)
                - (play.expected_opp_score * retaliation_mult)
                + bag_bonus
                + tactical_adj;

            // In Championship / Deep multi-ply mode, blend empirical 2-turn rollout margin
            if multi_ply {
                let empirical_spread_diff = play.net_margin - (play.score as f32 - play.expected_opp_score);
                final_val += empirical_spread_diff * 0.25;
            }

            play.total_val = (final_val * 10.0).round() / 10.0;
        });

    if crate::simulation::is_solve_cancelled(effective_solve_id) {
        return Vec::new();
    }

    // 4b. Strategic Tile Exchange & Dump Optimization (Phase 7)
    // When bag has at least 7 tiles, evaluate all 127 tile exchange combinations.
    let bag_allows_exchange = bag_count.is_none() || bag_count.unwrap_or(0) >= 7;
    if bag_allows_exchange && !is_true_endgame {
        if let Some(best_exch) = find_best_exchange_play(
            &board,
            rack,
            bag_count,
            score_differential,
            lexicon,
            equity_mode,
        ) {
            let top_board_val = plays.first().map(|p| p.total_val).unwrap_or(-999.0);
            // If the exchange beats the best board play, or is within 6.0 points of it, include it in candidate plays!
            if best_exch.total_val >= top_board_val - 6.0 || plays.is_empty() {
                plays.push(best_exch);
            }
        }
    }

    // 5. Final Sort
    if sort_mode == "score" {
        plays.sort_by(|a, b| b.score.cmp(&a.score));
    } else {
        plays.sort_by(|a, b| b.total_val.partial_cmp(&a.total_val).unwrap_or(std::cmp::Ordering::Equal));
    }

    plays
}

pub fn solve(board: Board, rack: &str, sort_mode: &str) -> Vec<CandidatePlay> {
    solve_advanced(board, rack, sort_mode, 0, None, None, None, None, None, None, None)
}

/// Evaluates all 2^N - 1 non-empty subsets of rack tiles to find the optimal strategic exchange.
/// Computes net 2-turn equity = 0 + leave_equity + (bingo_prob * 0.15) + bag_bonus - opponent_retaliation - tempo_tax.
pub fn find_best_exchange_play(
    board: &Board,
    full_rack: &str,
    bag_count: Option<u8>,
    score_differential: i16,
    lexicon: Option<&str>,
    equity_mode: Option<&str>,
) -> Option<CandidatePlay> {
    // In Scrabble rules, players can only exchange if bag has at least 7 tiles
    if let Some(bag) = bag_count {
        if bag < 7 {
            return None;
        }
    }

    let clean_rack: Vec<char> = full_rack
        .chars()
        .filter(|c| c.is_ascii_alphabetic() || *c == '?' || *c == '.' || *c == '*')
        .map(|c| c.to_ascii_uppercase())
        .collect();

    if clean_rack.is_empty() {
        return None;
    }

    let n = clean_rack.len().min(7);
    let gaddag = get_gaddag_for_lexicon(lexicon.unwrap_or("twl06"));
    let unseen_counts = compute_unseen_counts(board, full_rack);
    let runway_score = calculate_runway_score(board);
    let runway_mult = get_runway_multiplier(score_differential);
    let retaliation_mult = get_retaliation_multiplier(score_differential);
    let mode = equity_mode.unwrap_or("trained");

    // Baseline expected opponent score on current board
    let baseline_opp_score = 22.0f32;

    // Tempo adjustment: if ahead by > 20 pts, exchanging gives up tempo (-2.5).
    // If behind by > 20 pts, turnover is vital (+2.0).
    let tempo_tax = if score_differential > 20 {
        2.5
    } else if score_differential < -20 {
        -2.0
    } else {
        0.0
    };

    let total_subsets = 1usize << n;
    let mut best_play: Option<CandidatePlay> = None;
    let mut best_val = -999.0f32;
    let mut seen_swaps = std::collections::HashSet::new();

    // Evaluate each non-empty subset
    for mask in 1..total_subsets {
        let mut swapped_chars = Vec::with_capacity(n);
        let mut leave_chars = Vec::with_capacity(n);

        for (i, &ch) in clean_rack[..n].iter().enumerate() {
            if (mask & (1 << i)) != 0 {
                swapped_chars.push(ch);
            } else {
                leave_chars.push(ch);
            }
        }

        swapped_chars.sort_unstable();
        let swap_str: String = swapped_chars.into_iter().collect();

        if !seen_swaps.insert(swap_str.clone()) {
            continue; // Deduplicate identical swaps (e.g. rack with duplicate letters)
        }

        let leave_str: String = leave_chars.into_iter().collect();
        let (leave_equity, balance) = evaluate_leave_comprehensive(&leave_str, mode);

        // Compute bingo forecast for the leave
        let bingo_prob = forecast_bingo_probability(&leave_str, &unseen_counts, gaddag, 25, 0x5EED_0000 ^ (mask as u32));
        let bag_bonus = calculate_strategic_modifiers(score_differential, bag_count, swap_str.len() as u8);

        let total_val = leave_equity
            + (bingo_prob * 0.15)
            + (runway_score * runway_mult)
            - (baseline_opp_score * retaliation_mult)
            + bag_bonus
            - tempo_tax;

        let total_val_rounded = (total_val * 10.0).round() / 10.0;

        if total_val_rounded > best_val {
            best_val = total_val_rounded;
            let wildcards = leave_str.chars().filter(|&c| c == '?' || c == '.' || c == '*').count();
            let net_margin = leave_equity + (bingo_prob * 0.15) - (baseline_opp_score * retaliation_mult);
            let eff_diff = score_differential as f32 + net_margin;
            let win_prob = (1.0 / (1.0 + (-eff_diff / 28.0).exp())) * 100.0;

            best_play = Some(CandidatePlay {
                word: format!("EXCH {}", swap_str),
                row: 0,
                col: 0,
                is_vertical: false,
                score: 0,
                tiles_used: swap_str.len() as u8,
                is_bingo: false,
                leave: if leave_str.is_empty() { "None".to_string() } else { leave_str },
                leave_equity,
                total_val: total_val_rounded,
                bingo_prob_next_turn: bingo_prob,
                bingo_runway_score: runway_score,
                opp_best_reply: None,
                opp_best_score: 0,
                expected_opp_score: baseline_opp_score,
                exposes_3w: false,
                opens_triple_triple: false,
                opens_double_double: false,
                blocks_triple_triple: false,
                blocks_double_double: false,
                retains_blank: wildcards > 0,
                blank_surcharge_applied: swap_str.contains('?'),
                is_deterministic_opponent: false,
                is_endgame_setup: false,
                is_endgame_bait: false,
                vc_ratio: balance.vc_ratio,
                rack_balance_tag: balance.tag,
                rack_balance_desc: balance.description,
                is_exchange: true,
                win_prob: (win_prob * 10.0).round() / 10.0,
                net_margin: (net_margin * 10.0).round() / 10.0,
            });
        }
    }

    best_play
}

pub fn evaluate_exchange_play(
    tiles_to_exchange: &str,
    full_rack: &str,
    bag_count: Option<u8>,
    equity_mode: Option<&str>,
) -> CandidatePlay {
    let mode = equity_mode.unwrap_or("trained");
    let mut rack_chars = full_rack.chars().collect::<Vec<char>>();
    for c in tiles_to_exchange.chars() {
        if let Some(pos) = rack_chars.iter().position(|&x| x.to_ascii_uppercase() == c.to_ascii_uppercase()) {
            rack_chars.remove(pos);
        }
    }
    let leave: String = rack_chars.into_iter().collect();
    let (leave_equity, balance) = evaluate_leave_comprehensive(&leave, mode);

    let dummy_board = Board::new();
    let unseen_counts = compute_unseen_counts(&dummy_board, full_rack);
    let gaddag = get_gaddag_for_lexicon("twl06");
    let bingo_prob = forecast_bingo_probability(&leave, &unseen_counts, gaddag, 30, 1337);
    let runway_score = calculate_runway_score(&dummy_board);
    let bag_bonus = calculate_strategic_modifiers(0, bag_count, tiles_to_exchange.len() as u8);
    let total_val = leave_equity + (bingo_prob * 0.12) + bag_bonus;
    let wildcards = leave.chars().filter(|&c| c == '?' || c == '.' || c == '*').count();
    let net_margin = leave_equity + (bingo_prob * 0.12) - 22.0;
    let eff_diff = net_margin;
    let win_prob = (1.0 / (1.0 + (-eff_diff / 28.0).exp())) * 100.0;

    CandidatePlay {
        word: format!("EXCH {}", tiles_to_exchange.to_uppercase()),
        row: 0,
        col: 0,
        is_vertical: false,
        score: 0,
        tiles_used: tiles_to_exchange.len() as u8,
        is_bingo: false,
        leave: if leave.is_empty() { "None".to_string() } else { leave },
        leave_equity,
        total_val: (total_val * 10.0).round() / 10.0,
        bingo_prob_next_turn: bingo_prob,
        bingo_runway_score: runway_score,
        opp_best_reply: None,
        opp_best_score: 0,
        expected_opp_score: 0.0,
        exposes_3w: false,
        opens_triple_triple: false,
        opens_double_double: false,
        blocks_triple_triple: false,
        blocks_double_double: false,
        retains_blank: wildcards > 0,
        blank_surcharge_applied: false,
        is_deterministic_opponent: false,
        is_endgame_setup: false,
        is_endgame_bait: false,
        vc_ratio: balance.vc_ratio,
        rack_balance_tag: balance.tag,
        rack_balance_desc: balance.description,
        is_exchange: true,
        win_prob: (win_prob * 10.0).round() / 10.0,
        net_margin: (net_margin * 10.0).round() / 10.0,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_solve_advanced_with_bag_and_score() {
        let board = Board::new();
        let plays = solve_advanced(board, "SATINES", "strategic", 40, Some(5), None, None, None, None, None, None);

        assert!(!plays.is_empty());
        let top = &plays[0];
        println!(
            "\nLeading by 40 (Bag: 5): Top = {} ({} pts) | TotalVal = {} | OppReply = {:?}",
            top.word, top.score, top.total_val, top.opp_best_reply
        );
        assert!(top.is_bingo);
    }

    #[test]
    fn test_solve_advanced_with_manual_available_tiles() {
        let board = Board::new();
        let plays = solve_advanced(board, "SATINES", "strategic", 0, Some(0), None, Some("QIEX"), None, None, None, None);
        assert!(!plays.is_empty());
        let top = &plays[0];
        assert!(top.is_deterministic_opponent);
    }

    #[test]
    fn test_solve_different_lexicons() {
        let board1 = Board::new();
        let plays_twl = solve_advanced(board1, "SATINES", "strategic", 0, None, None, None, Some("twl06"), None, None, None);
        assert!(!plays_twl.is_empty());

        let board2 = Board::new();
        let plays_csw = solve_advanced(board2, "SATINES", "strategic", 0, None, None, None, Some("csw24"), None, None, None);
        assert!(!plays_csw.is_empty());
    }

    #[test]
    fn test_solve_static_vs_trained_equity() {
        let board1 = Board::new();
        let plays_trained = solve_advanced(board1, "SATINES", "strategic", 0, None, None, None, None, Some("trained"), None, None);
        assert!(!plays_trained.is_empty());

        let board2 = Board::new();
        let plays_static = solve_advanced(board2, "SATINES", "strategic", 0, None, None, None, None, Some("static"), None, None);
        assert!(!plays_static.is_empty());
    }

    #[test]
    fn test_solve_sim_quality_presets() {
        let board = Board::new();
        let plays_blitz = solve_advanced(board.clone(), "SATINES", "strategic", 0, None, None, None, None, None, Some("blitz"), None);
        assert!(!plays_blitz.is_empty());

        let plays_deep = solve_advanced(board, "SATINES", "strategic", 0, None, None, None, None, None, Some("deep"), None);
        assert!(!plays_deep.is_empty());
    }

    #[test]
    fn test_solve_pre_endgame_lookahead() {
        let board = Board::new();
        // Leading by 20, bag has 7 tiles
        let plays = solve_advanced(board, "SATINES", "strategic", 20, Some(7), None, None, None, None, None, None);
        assert!(!plays.is_empty());
        // A 7-letter bingo uses 7 tiles >= bag (7), so it should trigger is_endgame_setup
        let bingo_play = plays.iter().find(|p| p.tiles_used >= 7);
        if let Some(play) = bingo_play {
            assert!(play.is_endgame_setup, "7-tile play should empty bag of 7 and trigger endgame setup");
        }
    }

    #[test]
    fn test_turn1_opening_book_fastpath() {
        let board = Board::new();
        assert!(board.is_empty(), "Initial board must be empty");
        let plays = solve_advanced(board, "FARMERS", "strategic", 0, None, None, None, None, None, Some("blitz"), None);
        assert!(!plays.is_empty(), "Turn 1 opening moves must be generated");
        for p in &plays {
            let covers_h8 = if p.is_vertical {
                p.col == 7 && p.row <= 7 && (p.row + p.tiles_used as usize) > 7
            } else {
                p.row == 7 && p.col <= 7 && (p.col + p.tiles_used as usize) > 7
            };
            assert!(covers_h8, "Turn 1 play {} at ({}, {}) must cover H8", p.word, p.row, p.col);
        }
    }

    #[test]
    fn test_find_best_exchange_on_clunker_rack() {
        let board = Board::new();
        // A terrible clunker rack: Double-I, Double-V, Double-W (heavy clunkers and vowel skew)
        let exch = find_best_exchange_play(&board, "IIVVWWN", Some(20), 0, None, None);
        assert!(exch.is_some(), "Exchange should be recommended for clunker rack");
        let play = exch.unwrap();
        assert!(play.is_exchange);
        assert!(play.word.starts_with("EXCH "));
        println!("Recommended exchange: {} | Leave: {} ({}) | TotalVal: {}", play.word, play.leave, play.vc_ratio, play.total_val);
        // Swapping clunkers should ditch V clunkers and eliminate duplicate I and W
        assert!(!play.leave.contains('V'), "Leave should purge V clunkers");
        assert!(play.leave.matches('W').count() <= 1, "Leave should eliminate duplicate W clunker");
        assert!(play.leave.matches('I').count() <= 1, "Leave should eliminate duplicate I clunker");
    }

    #[test]
    fn test_exchange_disallowed_when_bag_under_7() {
        let board = Board::new();
        // Tournament Scrabble rule: exchanges prohibited if bag < 7
        let exch = find_best_exchange_play(&board, "IIVVWWN", Some(6), 0, None, None);
        assert!(exch.is_none(), "Exchange must be disallowed when bag < 7");
    }

    #[test]
    fn test_solve_advanced_injects_exchange_when_optimal() {
        let board = Board::new();
        // With an empty board and clunker rack, exchanging clunkers should be in candidate plays
        let plays = solve_advanced(board, "IIVVWWN", "strategic", 0, Some(25), None, None, None, None, Some("blitz"), None);
        assert!(!plays.is_empty());
        let has_exchange = plays.iter().any(|p| p.is_exchange);
        assert!(has_exchange, "Candidate plays should include optimal exchange play for clogged rack");
    }

    #[test]
    fn test_solve_championship_m1_rollout_metrics() {
        let board = Board::new();
        let plays = solve_advanced(board, "FARMERS", "strategic", 10, Some(30), None, None, None, None, Some("championship"), None);
        assert!(!plays.is_empty());
        let top = &plays[0];
        assert!(top.win_prob >= 0.0 && top.win_prob <= 100.0, "Win prob must be valid percentage: {}", top.win_prob);
        println!(
            "\nChampionship M1 Playout: Top Move = {} ({} pts) | WinProb = {}% | NetMargin = {} pts | TotalVal = {}",
            top.word, top.score, top.win_prob, top.net_margin, top.total_val
        );
    }

    #[test]
    fn test_solve_advanced_lead_spread_modulates_win_prob() {
        let board1 = Board::new();
        let plays_ahead = solve_advanced(board1, "FARMERS", "strategic", 60, Some(30), None, None, None, None, Some("blitz"), None);
        assert!(!plays_ahead.is_empty());

        let board2 = Board::new();
        let plays_behind = solve_advanced(board2, "FARMERS", "strategic", -60, Some(30), None, None, None, None, Some("blitz"), None);
        assert!(!plays_behind.is_empty());

        assert!(
            plays_ahead[0].win_prob > plays_behind[0].win_prob,
            "Leading by +60 must produce higher win probability than trailing by -60 (ahead: {}%, behind: {}%)",
            plays_ahead[0].win_prob, plays_behind[0].win_prob
        );
    }
}
