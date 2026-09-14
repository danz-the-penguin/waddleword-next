// src-tauri/src/bingo.rs - Bingo Runway Detection & Probability Forecaster

use crate::board::Board;
use crate::gaddag::Gaddag;

#[derive(Clone)]
pub struct FastPrng {
    state: u32,
}

impl FastPrng {
    pub fn new(seed: u32) -> Self {
        Self {
            state: seed.wrapping_add(0x6D2B79F5),
        }
    }

    pub fn next_u32(&mut self) -> u32 {
        let mut z = self.state.wrapping_add(0x6D2B79F5);
        self.state = z;
        z = (z ^ (z >> 15)).wrapping_mul(z | 1);
        z ^= z.wrapping_add((z ^ (z >> 7)).wrapping_mul(z | 61));
        z ^ (z >> 14)
    }

    pub fn next_f32(&mut self) -> f32 {
        (self.next_u32() >> 8) as f32 / 16777216.0
    }

    pub fn next_range(&mut self, max: usize) -> usize {
        if max == 0 {
            0
        } else {
            (self.next_u32() as usize) % max
        }
    }
}

/// Evaluates how many open 7-8 tile continuous runways exist through anchors on the board
pub fn calculate_runway_score(board: &Board) -> f32 {
    let mut runway_score = 0.0f32;

    // Horizontal check
    for r in 0..15 {
        let mut consecutive_empty = 0;
        let mut has_anchor = false;

        for c in 0..15 {
            let idx = r * 15 + c;
            if board.tiles[idx] == 0 {
                consecutive_empty += 1;
                if board.is_anchor[idx] {
                    has_anchor = true;
                }
            } else {
                if consecutive_empty >= 7 && has_anchor {
                    runway_score += 1.5;
                    if r >= 4 && r <= 10 {
                        runway_score += 0.5;
                    }
                }
                consecutive_empty = 0;
                has_anchor = false;
            }
        }
        if consecutive_empty >= 7 && has_anchor {
            runway_score += 1.5;
        }
    }

    // Vertical check
    for c in 0..15 {
        let mut consecutive_empty = 0;
        let mut has_anchor = false;

        for r in 0..15 {
            let idx = r * 15 + c;
            if board.tiles[idx] == 0 {
                consecutive_empty += 1;
                if board.is_anchor[idx] {
                    has_anchor = true;
                }
            } else {
                if consecutive_empty >= 7 && has_anchor {
                    runway_score += 1.5;
                    if c >= 4 && c <= 10 {
                        runway_score += 0.5;
                    }
                }
                consecutive_empty = 0;
                has_anchor = false;
            }
        }
        if consecutive_empty >= 7 && has_anchor {
            runway_score += 1.5;
        }
    }

    (runway_score * 10.0).round() / 10.0
}

/// Forecasts the probability (0.0% to 100.0%) that drawing from the unseen bag will yield a 7-letter bingo next turn
pub fn forecast_bingo_probability(
    leave: &str,
    unseen_counts: &[u8; 27],
    gaddag: &Gaddag,
    samples: usize,
    seed: u32,
) -> f32 {
    let leave_len = leave.len();
    let mut base_rack = [0u8; 26];
    let mut base_wildcards = 0u8;

    for ch in leave.chars() {
        if ch == '?' {
            base_wildcards += 1;
        } else if ('A'..='Z').contains(&ch) {
            base_rack[(ch as u8 - b'A') as usize] += 1;
        } else if ('a'..='z').contains(&ch) {
            base_rack[(ch as u8 - b'a') as usize] += 1;
        }
    }

    if leave_len >= 7 {
        let mut test_rack = base_rack;
        return if gaddag.has_bingo_anagram(&mut test_rack, base_wildcards) {
            100.0
        } else {
            0.0
        };
    }

    let need = 7 - leave_len;

    // Build bag pool
    let mut bag = Vec::with_capacity(100);
    for code in 0..27u8 {
        let count = unseen_counts[code as usize];
        for _ in 0..count {
            bag.push(code);
        }
    }

    if bag.len() < need {
        return 0.0;
    }

    let mut prng = FastPrng::new(seed);
    let mut bingo_hits = 0usize;
    let actual_samples = samples.max(10);

    for _ in 0..actual_samples {
        let mut sim_bag = bag.clone();
        let mut test_rack = base_rack;
        let mut test_wildcards = base_wildcards;

        for i in 0..need {
            let remaining = sim_bag.len() - i;
            let pick_offset = prng.next_range(remaining);
            let idx = i + pick_offset;
            sim_bag.swap(i, idx);
            let drawn = sim_bag[i];

            if drawn == 26 {
                test_wildcards += 1;
            } else {
                test_rack[drawn as usize] += 1;
            }
        }

        if gaddag.has_bingo_anagram(&mut test_rack, test_wildcards) {
            bingo_hits += 1;
        }
    }

    let prob = (bingo_hits as f32 / actual_samples as f32) * 100.0;
    (prob * 10.0).round() / 10.0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_bingo_probability_forecast() {
        let bytes = include_bytes!("../data/gaddag_twl06.bin");
        let gaddag = Gaddag::from_le_bytes(bytes);

        let mut unseen = [0u8; 27];
        unseen[0] = 9;  // A
        unseen[4] = 12; // E
        unseen[8] = 9;  // I
        unseen[14] = 8; // O
        unseen[20] = 4; // U
        unseen[18] = 4; // S
        unseen[19] = 6; // T
        unseen[17] = 6; // R
        unseen[13] = 6; // N
        unseen[26] = 2; // ?

        let prob_retina = forecast_bingo_probability("RETINA", &unseen, &gaddag, 50, 12345);
        assert!(prob_retina > 60.0);

        let prob_q = forecast_bingo_probability("QQQ", &unseen, &gaddag, 50, 12345);
        assert!(prob_q < 5.0);
    }
}
