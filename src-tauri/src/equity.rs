// src-tauri/src/equity.rs - Rack Leave Equity Evaluator with ML Synergy Weights

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{OnceLock, RwLock};

static TRAINED_WEIGHTS: OnceLock<HashMap<String, f32>> = OnceLock::new();
static CUSTOM_WEIGHTS: OnceLock<RwLock<HashMap<String, f32>>> = OnceLock::new();

pub const BASE_LEAVE_EQUITY: [f32; 26] = [
    1.5, -2.0, -0.5, 1.0, 3.0, -2.0, -1.5, -1.0, 1.2, -2.5, -2.5, 1.2, -0.5, 2.0, -0.5, -1.0,
    -7.5, 3.2, 8.0, 2.5, -3.0, -5.5, -2.5, 3.5, 0.0, 2.0,
];
pub const BLANK_LEAVE_EQUITY: f32 = 25.5;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct RackBalanceAnalysis {
    pub vc_ratio: String,
    pub v_count: usize,
    pub c_count: usize,
    pub tag: String,
    pub description: String,
    pub equity_adjustment: f32,
}

const BINGO_STEMS_6: &[&str] = &[
    "TISANE", "SATIRE", "RETINA", "ARISEN", "SENORA", "STALER", "AERIST", "ORLEAN",
    "TOERAG", "EASTER", "NOTHER", "BARNET", "REASON", "ISLAND", "SENIOR", "TAILER",
];

const BINGO_STEMS_5: &[&str] = &[
    "TISAN", "SATIR", "RETIN", "ARISE", "STALE", "REAST", "ALERT", "ROAST",
    "STANE", "SLATE", "TARNS", "REINS", "RAISE", "RENTS", "STERN", "ASTER",
    "TIRES", "SNORT", "TRAIN", "STRAW", "LINES", "LANES", "RATES", "TEARS",
];

const BINGO_STEMS_4: &[&str] = &[
    "ERST", "REST", "TRES", "RATE", "TALE", "LANE", "SEAT", "STAR",
    "TEAS", "NETS", "SENT", "TENS", "TIRE", "RITE", "ROTE", "TORE",
];

fn is_stem_subset(sorted_leave: &str, stem: &str) -> bool {
    let mut stem_chars: Vec<char> = stem.chars().collect();
    stem_chars.sort_unstable();

    if stem_chars.len() > sorted_leave.len() {
        return false;
    }

    let mut leave_iter = sorted_leave.chars();
    for target in stem_chars {
        loop {
            match leave_iter.next() {
                Some(c) if c == target => break,
                Some(c) if c > target => return false,
                Some(_) => continue,
                None => return false,
            }
        }
    }
    true
}

pub fn analyze_rack_balance(leave: &str) -> RackBalanceAnalysis {
    if leave.is_empty() || leave.eq_ignore_ascii_case("none") {
        return RackBalanceAnalysis {
            vc_ratio: "0V/0C".to_string(),
            v_count: 0,
            c_count: 0,
            tag: "empty".to_string(),
            description: "Empty Rack (Out)".to_string(),
            equity_adjustment: 0.0,
        };
    }

    let mut v_count = 0usize;
    let mut c_count = 0usize;
    let mut blanks = 0usize;
    let mut counts = [0u8; 26];

    for ch in leave.chars() {
        if ch == '?' || ch == '.' || ch == '*' {
            blanks += 1;
        } else if ch.is_ascii_alphabetic() {
            let upper = ch.to_ascii_uppercase();
            let idx = (upper as u8 - b'A') as usize;
            if idx < 26 {
                counts[idx] += 1;
                if matches!(upper, 'A' | 'E' | 'I' | 'O' | 'U') {
                    v_count += 1;
                } else {
                    c_count += 1;
                }
            }
        }
    }

    let vc_ratio = if blanks > 0 {
        format!("{}V/{}C/{}?", v_count, c_count, blanks)
    } else {
        format!("{}V/{}C", v_count, c_count)
    };

    let total_tiles = v_count + c_count + blanks;
    let mut adjustment = 0.0f32;
    let mut tags = Vec::new();
    let mut reasons = Vec::new();

    // 1. Duplicate Letter Penalties
    if counts[(b'I' - b'A') as usize] == 2 {
        adjustment -= 7.5;
        tags.push("duplicate_penalty");
        reasons.push("Double-I (-7.5)".to_string());
    } else if counts[(b'I' - b'A') as usize] >= 3 {
        adjustment -= 16.0;
        tags.push("duplicate_penalty");
        reasons.push("Triple-I (-16.0)".to_string());
    }

    if counts[(b'U' - b'A') as usize] == 2 {
        adjustment -= 9.0;
        tags.push("duplicate_penalty");
        reasons.push("Double-U (-9.0)".to_string());
    } else if counts[(b'U' - b'A') as usize] >= 3 {
        adjustment -= 18.0;
        tags.push("duplicate_penalty");
        reasons.push("Triple-U (-18.0)".to_string());
    }

    if counts[(b'O' - b'A') as usize] == 2 {
        adjustment -= 4.5;
        tags.push("duplicate_penalty");
        reasons.push("Double-O (-4.5)".to_string());
    } else if counts[(b'O' - b'A') as usize] >= 3 {
        adjustment -= 12.0;
        tags.push("duplicate_penalty");
        reasons.push("Triple-O (-12.0)".to_string());
    }

    if counts[(b'A' - b'A') as usize] == 2 {
        adjustment -= 3.0;
        tags.push("duplicate_penalty");
        reasons.push("Double-A (-3.0)".to_string());
    } else if counts[(b'A' - b'A') as usize] >= 3 {
        adjustment -= 9.0;
        tags.push("duplicate_penalty");
        reasons.push("Triple-A (-9.0)".to_string());
    }

    if counts[(b'E' - b'A') as usize] >= 3 {
        adjustment -= 6.0;
        tags.push("duplicate_penalty");
        reasons.push("Triple-E (-6.0)".to_string());
    }

    // Heavy Clunker Duplicates
    if counts[(b'V' - b'A') as usize] >= 2 {
        adjustment -= 12.0;
        tags.push("duplicate_penalty");
        reasons.push("Double-V (-12.0)".to_string());
    }
    if counts[(b'W' - b'A') as usize] >= 2 {
        adjustment -= 10.0;
        tags.push("duplicate_penalty");
        reasons.push("Double-W (-10.0)".to_string());
    }
    if counts[(b'K' - b'A') as usize] >= 2 {
        adjustment -= 9.0;
        tags.push("duplicate_penalty");
        reasons.push("Double-K (-9.0)".to_string());
    }

    // Blank Clogged by Clunkers (Phase 3)
    if blanks > 0 {
        if counts[(b'Q' - b'A') as usize] > 0 && counts[(b'U' - b'A') as usize] == 0 {
            adjustment -= 4.0;
            tags.push("blank_clogged");
            reasons.push("Blank Clogged (Unpaired Q: -4.0)".to_string());
        }
        let heavy_clunkers = counts[(b'V' - b'A') as usize] + counts[(b'W' - b'A') as usize] + counts[(b'J' - b'A') as usize];
        if heavy_clunkers >= 2 {
            adjustment -= 3.5;
            tags.push("blank_clogged");
            reasons.push("Blank Clogged (Heavy Clunkers: -3.5)".to_string());
        }
    }

    // 2. V/C Balance & Starvation Penalties
    if total_tiles >= 2 {
        if v_count == 0 && blanks == 0 {
            let p = match total_tiles {
                2 => 3.0,
                3 => 8.0,
                _ => 14.0,
            };
            adjustment -= p;
            tags.push("consonant_heavy");
            reasons.push(format!("Consonant Starved (0V: -{:.1})", p));
        } else if c_count == 0 && blanks == 0 {
            let p = match total_tiles {
                2 => 4.5,
                3 => 11.0,
                _ => 18.0,
            };
            adjustment -= p;
            tags.push("vowel_heavy");
            reasons.push(format!("Vowel Clogged (0C: -{:.1})", p));
        } else if v_count >= 4 && c_count <= 1 && blanks == 0 {
            adjustment -= 9.5;
            tags.push("vowel_heavy");
            reasons.push("Vowel Heavy (4+V: -9.5)".to_string());
        } else if v_count >= 3 && c_count == 1 && total_tiles == 4 && blanks == 0 {
            adjustment -= 5.0;
            tags.push("vowel_heavy");
            reasons.push("Vowel Skew (3V/1C: -5.0)".to_string());
        } else if c_count >= 5 && v_count <= 1 && blanks == 0 {
            adjustment -= 8.5;
            tags.push("consonant_heavy");
            reasons.push("Consonant Heavy (5+C: -8.5)".to_string());
        }
    }

    // 3. Tournament Bingo Stem Affinity
    let mut sorted_chars: Vec<char> = leave
        .chars()
        .filter(|c| c.is_ascii_alphabetic())
        .map(|c| c.to_ascii_uppercase())
        .collect();
    sorted_chars.sort_unstable();
    let sorted_leave: String = sorted_chars.iter().collect();

    let mut found_stem = false;
    for &stem in BINGO_STEMS_6 {
        if is_stem_subset(&sorted_leave, stem) {
            adjustment += 6.5;
            tags.push("bingo_stem");
            reasons.push(format!("Grandmaster Stem ({} +6.5)", stem));
            found_stem = true;
            break;
        }
    }

    if !found_stem {
        for &stem in BINGO_STEMS_5 {
            if is_stem_subset(&sorted_leave, stem) {
                adjustment += 4.5;
                tags.push("bingo_stem");
                reasons.push(format!("Primary Stem ({} +4.5)", stem));
                found_stem = true;
                break;
            }
        }
    }

    if !found_stem {
        for &stem in BINGO_STEMS_4 {
            if is_stem_subset(&sorted_leave, stem) {
                adjustment += 2.5;
                tags.push("bingo_stem");
                reasons.push(format!("Core Stem ({} +2.5)", stem));
                break;
            }
        }
    }

    // 4. Equilibrium Bonus (if no penalties and balanced ratio)
    if tags.is_empty() {
        let is_ideal = matches!(
            (v_count, c_count),
            (1, 1) | (1, 2) | (2, 1) | (2, 2) | (1, 3) | (2, 3) | (3, 2) | (2, 4) | (3, 3) | (3, 4)
        );
        if is_ideal {
            adjustment += 1.5;
            tags.push("balanced");
            reasons.push(format!("Balanced {} (+1.5)", vc_ratio));
        }
    }

    let primary_tag = tags.first().unwrap_or(&"neutral").to_string();
    let description = if reasons.is_empty() {
        format!("Standard {}", vc_ratio)
    } else {
        reasons.join(" | ")
    };

    RackBalanceAnalysis {
        vc_ratio,
        v_count,
        c_count,
        tag: primary_tag,
        description,
        equity_adjustment: (adjustment * 10.0).round() / 10.0,
    }
}

pub fn evaluate_leave_comprehensive(leave: &str, equity_mode: &str) -> (f32, RackBalanceAnalysis) {
    let balance = analyze_rack_balance(leave);
    let base_eq = evaluate_leave_with_mode(leave, equity_mode);
    let total_eq = ((base_eq + balance.equity_adjustment) * 10.0).round() / 10.0;
    (total_eq, balance)
}

pub fn get_trained_weights() -> &'static HashMap<String, f32> {
    TRAINED_WEIGHTS.get_or_init(|| {
        let json_str = include_str!("../data/synergy_trained.json");
        serde_json::from_str(json_str).unwrap_or_default()
    })
}

fn get_custom_weights_lock() -> &'static RwLock<HashMap<String, f32>> {
    CUSTOM_WEIGHTS.get_or_init(|| RwLock::new(HashMap::new()))
}

pub fn get_custom_weights() -> HashMap<String, f32> {
    get_custom_weights_lock().read().unwrap().clone()
}

pub fn set_custom_weight(leave: &str, weight: f32) {
    let mut chars: Vec<char> = leave.trim().to_uppercase().chars().collect();
    chars.sort_unstable();
    let sorted: String = chars.iter().collect();
    get_custom_weights_lock().write().unwrap().insert(sorted, weight);
}

pub fn import_custom_weights_json(json_str: &str) -> Result<usize, String> {
    let map: HashMap<String, f32> = serde_json::from_str(json_str).map_err(|e| e.to_string())?;
    let count = map.len();
    let mut lock = get_custom_weights_lock().write().unwrap();
    for (k, v) in map {
        let mut chars: Vec<char> = k.trim().to_uppercase().chars().collect();
        chars.sort_unstable();
        lock.insert(chars.iter().collect(), v);
    }
    Ok(count)
}

pub fn export_custom_weights_json() -> String {
    let weights = get_custom_weights();
    serde_json::to_string_pretty(&weights).unwrap_or_else(|_| "{}".to_string())
}

pub fn reset_custom_weights() {
    let mut lock = get_custom_weights_lock().write().unwrap();
    lock.clear();
}

pub fn evaluate_leave(leave: &str) -> f32 {
    evaluate_leave_with_mode(leave, "trained")
}

pub fn evaluate_leave_with_mode(leave: &str, equity_mode: &str) -> f32 {
    if leave.is_empty() {
        return 0.0;
    }

    let mut chars: Vec<char> = leave.chars().collect();
    chars.sort_unstable();
    let sorted_str: String = chars.iter().collect();

    if equity_mode.eq_ignore_ascii_case("custom") {
        let custom = get_custom_weights_lock().read().unwrap();
        if let Some(&w) = custom.get(&sorted_str) {
            return w;
        }
        let weights = get_trained_weights();
        if let Some(&w) = weights.get(&sorted_str) {
            return w;
        }
    } else if equity_mode.eq_ignore_ascii_case("trained") {
        let weights = get_trained_weights();
        if let Some(&w) = weights.get(&sorted_str) {
            return w;
        }
    }

    // Fallback: Base Equity & Combinations
    let mut equity = 0.0f32;
    let mut v_count = 0usize;
    let mut c_count = 0usize;
    let mut blanks = 0usize;
    let mut counts = [0u8; 26];

    for &ch in &chars {
        if ch == '?' {
            equity += BLANK_LEAVE_EQUITY;
            blanks += 1;
        } else if ('A'..='Z').contains(&ch) {
            let idx = (ch as u8 - b'A') as usize;
            counts[idx] += 1;
            equity += BASE_LEAVE_EQUITY[idx];

            if ch == 'A' || ch == 'E' || ch == 'I' || ch == 'O' || ch == 'U' {
                v_count += 1;
            } else if ch != 'Y' {
                c_count += 1;
            }
        }
    }

    // Triplet & Quadruplet Penalties
    for c in 0..26 {
        if counts[c] == 3 {
            equity -= 10.0;
        } else if counts[c] >= 4 {
            equity -= 25.0;
        }
    }

    // Starvation penalties
    let total_tiles = chars.len();
    if total_tiles >= 4 {
        if v_count == 0 && blanks == 0 {
            equity -= 12.0;
        }
        if c_count == 0 && blanks == 0 {
            equity -= 12.0;
        }
        if v_count > c_count + 3 {
            equity -= 2.5;
        }
        if c_count > v_count + 3 {
            equity -= 2.5;
        }
    }

    // Q without U penalty
    if counts[16] > 0 && counts[20] == 0 && blanks == 0 {
        equity -= 15.0;
    }

    (equity * 10.0).round() / 10.0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_leave_equity() {
        let weights = get_trained_weights();
        assert!(!weights.is_empty(), "Trained weights should load");

        // Perfect bingo stems should have high positive equity
        let eq_ceirst = evaluate_leave("CEIRST");
        println!("CEIRST leave equity: {}", eq_ceirst);
        assert!(eq_ceirst > 15.0, "CEIRST should have high positive equity");

        // Q without U should have negative equity
        let eq_q = evaluate_leave("Q");
        println!("Q leave equity: {}", eq_q);
        assert!(eq_q < 0.0, "Unpaired Q must have negative equity");
    }

    #[test]
    fn test_custom_leave_weights() {
        reset_custom_weights();
        set_custom_weight("XYZ", 33.5);
        assert_eq!(evaluate_leave_with_mode("XYZ", "custom"), 33.5);

        let json = export_custom_weights_json();
        assert!(json.contains("33.5"));

        reset_custom_weights();
        assert_ne!(evaluate_leave_with_mode("XYZ", "custom"), 33.5);

        import_custom_weights_json(&json).unwrap();
        assert_eq!(evaluate_leave_with_mode("XYZ", "custom"), 33.5);
    }

    #[test]
    fn test_rack_vc_equilibrium() {
        // Balanced leave without duplicates should receive equilibrium bonus
        let bal = analyze_rack_balance("DE");
        assert_eq!(bal.v_count, 1);
        assert_eq!(bal.c_count, 1);
        assert_eq!(bal.tag, "balanced");
        assert!(bal.equity_adjustment > 0.0);

        // Extreme consonant skew (5C / 0V) should be penalized heavily
        let skew = analyze_rack_balance("BCCDF");
        assert_eq!(skew.v_count, 0);
        assert_eq!(skew.c_count, 5);
        assert_eq!(skew.tag, "consonant_heavy");
        assert!(skew.equity_adjustment < -10.0);

        // Extreme vowel skew (4V / 0C) should be penalized heavily
        let v_skew = analyze_rack_balance("AEOU");
        assert_eq!(v_skew.v_count, 4);
        assert_eq!(v_skew.c_count, 0);
        assert_eq!(v_skew.tag, "vowel_heavy");
        assert!(v_skew.equity_adjustment < -10.0);
    }

    #[test]
    fn test_duplicate_letter_penalties() {
        // Multiple clunkers like VV, WW, KK or III should trigger duplicate penalties
        let double_v = analyze_rack_balance("VVT");
        assert_eq!(double_v.tag, "duplicate_penalty");
        assert!(double_v.description.contains("Double-V"));
        assert!(double_v.equity_adjustment <= -12.0);

        let triple_i = analyze_rack_balance("IIIR");
        assert_eq!(triple_i.tag, "duplicate_penalty");
        assert!(triple_i.description.contains("Triple-I"));
        assert!(triple_i.equity_adjustment <= -16.0);
    }

    #[test]
    fn test_bingo_stem_retention() {
        // Top tournament stems like RETINA or TISANE should trigger Grandmaster Stem bonus
        let stem = analyze_rack_balance("RETINA");
        assert_eq!(stem.tag, "bingo_stem");
        assert!(stem.description.contains("Grandmaster Stem"));
        assert!(stem.equity_adjustment >= 6.0);

        let sub_stem = analyze_rack_balance("TISAN");
        assert_eq!(sub_stem.tag, "bingo_stem");
        assert!(sub_stem.description.contains("Primary Stem"));
        assert!(sub_stem.equity_adjustment >= 4.0);
    }

    #[test]
    fn test_blank_clogged_by_clunkers() {
        let q_blank = analyze_rack_balance("?Q");
        assert_eq!(q_blank.tag, "blank_clogged");
        assert!(q_blank.description.contains("Unpaired Q"));
        assert!(q_blank.equity_adjustment <= -4.0);

        let clunker_blank = analyze_rack_balance("?VW");
        assert_eq!(clunker_blank.tag, "blank_clogged");
        assert!(clunker_blank.description.contains("Heavy Clunkers"));
        assert!(clunker_blank.equity_adjustment <= -3.5);
    }
}
