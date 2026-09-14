// src-tauri/src/strategy.rs - Lead Volatility Asymmetry & Pre-Endgame Bag Depletion

#[derive(Debug, Clone, Copy)]
pub struct StrategicModifiers {
    pub retaliation_weight: f32, // Multiplier for expected opponent reply
    pub runway_weight: f32,      // Multiplier for opening bingo runways
    pub bag_bleed_bonus: f32,    // Bonus for emptying the bag when ahead
    pub bag_freeze_bonus: f32,   // Bonus for keeping bag alive when behind
}

pub fn calculate_strategic_modifiers(
    score_differential: i16,
    bag_count: Option<u8>,
    tiles_used: u8,
) -> f32 {
    let mut net_bonus = 0.0f32;

    // 1. Lead Volatility Asymmetry
    // (Leading -> Risk-Averse board closure; Trailing -> Variance-seeking bingo hunting)
    let _modifiers = if score_differential > 30 {
        StrategicModifiers {
            retaliation_weight: 1.25, // Heavily penalize opening retaliations
            runway_weight: 0.15,      // Do not open board for opponent
            bag_bleed_bonus: 4.5,
            bag_freeze_bonus: 0.0,
        }
    } else if score_differential < -30 {
        StrategicModifiers {
            retaliation_weight: 0.50, // Accept risk
            runway_weight: 0.55,      // Actively hunt for bingo runways
            bag_bleed_bonus: 0.0,
            bag_freeze_bonus: 4.0,
        }
    } else {
        StrategicModifiers {
            retaliation_weight: 0.85,
            runway_weight: 0.30,
            bag_bleed_bonus: 2.0,
            bag_freeze_bonus: 2.0,
        }
    };

    // 2. Pre-Endgame Bag Manipulation (1 to 7 tiles in bag)
    if let Some(bag) = bag_count {
        if bag >= 1 && bag <= 7 {
            if score_differential > 20 {
                // Leading: Bleed bag to 0 to seize terminal control
                if tiles_used >= bag {
                    net_bonus += 5.0; // Empties bag!
                } else if tiles_used >= bag.saturating_sub(1) {
                    net_bonus += 2.5;
                }
            } else if score_differential < -20 {
                // Trailing: Freeze bag to prevent opponent shutout
                if tiles_used < bag {
                    net_bonus += 3.5; // Keeps tiles in bag!
                }
            }
        }
    }

    net_bonus
}

pub fn get_retaliation_multiplier(score_differential: i16) -> f32 {
    if score_differential > 30 {
        1.25
    } else if score_differential < -30 {
        0.50
    } else {
        0.85
    }
}

pub fn get_runway_multiplier(score_differential: i16) -> f32 {
    if score_differential > 30 {
        0.15
    } else if score_differential < -30 {
        0.55
    } else {
        0.30
    }
}
