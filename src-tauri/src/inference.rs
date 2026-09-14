// src-tauri/src/inference.rs - Bayesian Negative Inference (Opponent Rack Modeling)

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct OpponentPlayContext {
    pub word: String,
    pub score: i16,
    pub had_open_3w: bool,
    pub had_open_bingo_lane: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TileBayesianInference {
    pub letter: String,
    pub count: u8,
    pub likelihood_multiplier: f32,
    pub category: String, // "elevated" | "neutral" | "discounted"
    pub explanation: String,
}

/// Computes Bayesian rack weights for each of the 27 tile types (0..25 = A..Z, 26 = ?)
/// High-value tiles that the opponent failed to play on open lanes are heavily discounted,
/// while clunky / defensive tiles are elevated.
pub fn compute_inference_weights(context: Option<&OpponentPlayContext>) -> [f32; 27] {
    let mut weights = [1.0f32; 27];

    if let Some(ctx) = context {
        // Did the opponent miss an open Triple-Word line with a low score?
        if ctx.had_open_3w && ctx.score < 28 {
            weights[26] = 0.15; // Blank: very unlikely in opponent hand
            weights[25] = 0.10; // Z
            weights[23] = 0.10; // X
            weights[16] = 0.15; // Q
            weights[9] = 0.20;  // J
        }

        // Did the opponent fail to bingo despite having an open runway?
        if ctx.had_open_bingo_lane && ctx.score < 40 {
            weights[26] *= 0.50; // Blank
            weights[18] *= 0.65; // S
            weights[4] *= 0.80;  // E
            weights[17] *= 0.80; // R
            weights[19] *= 0.80; // T
        }

        // When opponent plays a low-scoring move (<25 pts), elevate likelihood of clunky consonants & vowel duplicates
        if ctx.score > 0 && ctx.score < 25 {
            weights[21] = 1.35; // V
            weights[22] = 1.30; // W
            weights[20] = 1.25; // U
            weights[2] = 1.25;  // C
            weights[1] = 1.20;  // B
            weights[15] = 1.20; // P
        }
    }

    weights
}

/// Returns a detailed breakdown of each unseen tile's Bayesian probability rating.
pub fn get_detailed_bayesian_inference(
    context: Option<&OpponentPlayContext>,
    unseen_counts: &[u8; 27],
) -> Vec<TileBayesianInference> {
    let raw_weights = compute_inference_weights(context);
    let mut results = Vec::with_capacity(27);

    for code in 0..27 {
        let count = unseen_counts[code];
        let letter = if code == 26 {
            "?".to_string()
        } else {
            ((b'A' + code as u8) as char).to_string()
        };

        let mult = raw_weights[code];
        let (category, explanation) = if mult <= 0.35 {
            (
                "discounted".to_string(),
                format!(
                    "Unlikely in opponent rack: missed high-value scoring opportunity ({}% prior)",
                    (mult * 100.0).round() as u32
                ),
            )
        } else if mult <= 0.85 {
            (
                "discounted".to_string(),
                format!(
                    "Slightly discounted: unplayed during open bingo runway ({}% prior)",
                    (mult * 100.0).round() as u32
                ),
            )
        } else if mult >= 1.25 {
            (
                "elevated".to_string(),
                format!(
                    "Elevated probability: opponent holding awkward consonants / vowel duplicates (+{}%)",
                    ((mult - 1.0) * 100.0).round() as u32
                ),
            )
        } else {
            (
                "neutral".to_string(),
                "Standard unconditioned prior probability".to_string(),
            )
        };

        results.push(TileBayesianInference {
            letter,
            count,
            likelihood_multiplier: mult,
            category,
            explanation,
        });
    }

    results
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_negative_inference_discount() {
        // Opponent only scored 14 points despite an open 3W lane
        let ctx = OpponentPlayContext {
            word: "FIN".to_string(),
            score: 14,
            had_open_3w: true,
            had_open_bingo_lane: true,
        };

        let weights = compute_inference_weights(Some(&ctx));

        // Power tiles and blanks should be heavily discounted
        assert!(weights[25] <= 0.15, "Z should be heavily discounted");
        assert!(weights[23] <= 0.15, "X should be heavily discounted");
        assert!(weights[26] <= 0.10, "Blank should be near-zero probability in opp hand");
        assert!(weights[21] >= 1.25, "V should be elevated for clunky rack");
    }

    #[test]
    fn test_detailed_bayesian_breakdown() {
        let ctx = OpponentPlayContext {
            word: "OF".to_string(),
            score: 12,
            had_open_3w: true,
            had_open_bingo_lane: false,
        };

        let mut unseen = [0u8; 27];
        unseen[26] = 2; // ?
        unseen[25] = 1; // Z
        unseen[21] = 2; // V
        unseen[0] = 5;  // A

        let breakdown = get_detailed_bayesian_inference(Some(&ctx), &unseen);
        assert_eq!(breakdown.len(), 27);

        let z_inf = breakdown.iter().find(|t| t.letter == "Z").unwrap();
        assert_eq!(z_inf.category, "discounted");

        let v_inf = breakdown.iter().find(|t| t.letter == "V").unwrap();
        assert_eq!(v_inf.category, "elevated");
    }
}
