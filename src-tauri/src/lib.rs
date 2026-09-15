pub mod bingo;
pub mod board;
pub mod endgame;
pub mod equity;
pub mod gaddag;
pub mod gaddag_compiler;
pub mod generator;
pub mod inference;
pub mod simulation;
pub mod solver;
pub mod strategy;

use board::Board;
use generator::CandidatePlay;
use inference::OpponentPlayContext;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn solve_board(
    board_tiles: Vec<Vec<Option<String>>>,
    rack: String,
    sort_mode: Option<String>,
    score_differential: Option<i16>,
    bag_count: Option<u8>,
    last_opp_play: Option<OpponentPlayContext>,
    manual_available_tiles: Option<String>,
    lexicon: Option<String>,
    equity_mode: Option<String>,
    sim_quality: Option<String>,
) -> Result<Vec<CandidatePlay>, String> {
    let mut board = Board::new();
    for r in 0..15 {
        if r < board_tiles.len() {
            for c in 0..15 {
                if c < board_tiles[r].len() {
                    if let Some(ref val) = board_tiles[r][c] {
                        if !val.is_empty() {
                            let ch = val.chars().next().unwrap();
                            let is_blank = ch.is_ascii_lowercase();
                            board.set_tile(r, c, ch, is_blank);
                        }
                    }
                }
            }
        }
    }

    let mode = sort_mode.unwrap_or_else(|| "strategic".to_string());
    let diff = score_differential.unwrap_or(0);
    let solve_id = simulation::next_solve_id();

    Ok(solver::solve_advanced(
        board,
        &rack,
        &mode,
        diff,
        bag_count,
        last_opp_play.as_ref(),
        manual_available_tiles.as_deref(),
        lexicon.as_deref(),
        equity_mode.as_deref(),
        sim_quality.as_deref(),
        Some(solve_id),
    ))
}

#[tauri::command]
fn cancel_current_solve() {
    solver::cancel_current_solve();
}

#[tauri::command]
fn steebot_choose_move(
    board_tiles: Vec<Vec<Option<String>>>,
    bot_rack: String,
    score_differential: Option<i16>,
    bag_count: Option<u8>,
    lexicon: Option<String>,
    sim_quality: Option<String>,
) -> Result<Option<CandidatePlay>, String> {
    let mut board = Board::new();
    for r in 0..15 {
        if r < board_tiles.len() {
            for c in 0..15 {
                if c < board_tiles[r].len() {
                    if let Some(ref val) = board_tiles[r][c] {
                        if !val.is_empty() {
                            let ch = val.chars().next().unwrap();
                            let is_blank = ch.is_ascii_lowercase();
                            board.set_tile(r, c, ch, is_blank);
                        }
                    }
                }
            }
        }
    }

    let diff = score_differential.unwrap_or(0);
    let quality = sim_quality.unwrap_or_else(|| "championship".to_string());
    let solve_id = simulation::next_solve_id();
    let plays = solver::solve_advanced(
        board,
        &bot_rack,
        "strategic",
        diff,
        bag_count,
        None,
        None,
        lexicon.as_deref(),
        Some("trained"),
        Some(&quality),
        Some(solve_id),
    );

    Ok(plays.into_iter().next())
}

const DICT_BYTES: &[u8] = include_bytes!("../data/tournament_definitions.bin");

#[tauri::command]
fn get_word_definition(word: String, _lexicon: Option<String>) -> Option<String> {
    if word.len() < 2 || word.len() > 15 {
        return None;
    }
    let target = word.to_ascii_uppercase();
    if DICT_BYTES.len() < 16 {
        return None;
    }
    let num_words = u32::from_le_bytes(DICT_BYTES[12..16].try_into().ok()?) as usize;
    let index_end = 16 + num_words * 22;
    if DICT_BYTES.len() < index_end {
        return None;
    }
    let index_bytes = &DICT_BYTES[16..index_end];
    let defs_offset = index_end;

    let mut low = 0;
    let mut high = num_words;

    let mut target_padded = [0u8; 16];
    target_padded[..target.len()].copy_from_slice(target.as_bytes());

    while low < high {
        let mid = (low + high) / 2;
        let entry = &index_bytes[mid * 22..(mid + 1) * 22];
        let word_entry = &entry[0..16];

        match word_entry.cmp(&target_padded) {
            std::cmp::Ordering::Less => low = mid + 1,
            std::cmp::Ordering::Greater => high = mid,
            std::cmp::Ordering::Equal => {
                let offset = u32::from_le_bytes(entry[16..20].try_into().ok()?) as usize;
                let len = u16::from_le_bytes(entry[20..22].try_into().ok()?) as usize;
                let end = defs_offset + offset + len;
                if end <= DICT_BYTES.len() {
                    let def_slice = &DICT_BYTES[defs_offset + offset..end];
                    return std::str::from_utf8(def_slice).ok().map(|s| s.to_string());
                }
                return None;
            }
        }
    }
    None
}

#[tauri::command]
fn check_word(word: String, lexicon: Option<String>) -> bool {
    let lex = lexicon.as_deref().unwrap_or("twl06");
    let gaddag = solver::get_gaddag_for_lexicon(lex);
    gaddag.is_word_valid(&word)
}

#[tauri::command]
fn get_word_hooks(word: String, lexicon: Option<String>) -> gaddag::WordHooks {
    let lex = lexicon.as_deref().unwrap_or("twl06");
    let gaddag = solver::get_gaddag_for_lexicon(lex);
    gaddag.get_hooks(&word)
}

#[tauri::command]
fn find_rack_anagrams(rack: String, lexicon: Option<String>) -> Vec<String> {
    let lex = lexicon.as_deref().unwrap_or("twl06");
    let gaddag = solver::get_gaddag_for_lexicon(lex);
    let mut rack_counts = [0u8; 26];
    let mut wildcards = 0u8;

    for b in rack.bytes() {
        if (b'a'..=b'z').contains(&b) {
            rack_counts[(b - b'a') as usize] += 1;
        } else if (b'A'..=b'Z').contains(&b) {
            rack_counts[(b - b'A') as usize] += 1;
        } else if b == b'?' || b == b'.' || b == b'*' || b == b'_' || b == b'0' {
            wildcards += 1;
        }
    }

    gaddag.find_subwords(&mut rack_counts, wildcards, 2, 8)
}

#[tauri::command]
fn evaluate_tile_exchange(
    tiles_to_exchange: String,
    full_rack: String,
    bag_count: Option<u8>,
    equity_mode: Option<String>,
) -> CandidatePlay {
    solver::evaluate_exchange_play(
        &tiles_to_exchange,
        &full_rack,
        bag_count,
        equity_mode.as_deref(),
    )
}

#[tauri::command]
fn find_best_exchange(
    board_state: Option<Vec<Vec<Option<char>>>>,
    rack: String,
    bag_count: Option<u8>,
    score_differential: Option<i16>,
    lexicon: Option<String>,
    equity_mode: Option<String>,
) -> Option<CandidatePlay> {
    let mut b = board::Board::new();
    if let Some(cells) = board_state {
        for r in 0..15 {
            for c in 0..15 {
                if let Some(Some(ch)) = cells.get(r).and_then(|row| row.get(c)) {
                    let is_blank = ch.is_ascii_lowercase();
                    b.set_tile(r, c, ch.to_ascii_uppercase(), is_blank);
                }
            }
        }
    }
    solver::find_best_exchange_play(
        &b,
        &rack,
        bag_count,
        score_differential.unwrap_or(0),
        lexicon.as_deref(),
        equity_mode.as_deref(),
    )
}

#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
pub struct CustomGaddagResult {
    pub success: bool,
    pub word_count: usize,
    pub node_count: usize,
    pub byte_size: usize,
    pub message: String,
}

#[tauri::command]
fn compile_and_load_custom_gaddag(word_list_text: String) -> Result<CustomGaddagResult, String> {
    let compiled = gaddag_compiler::compile_word_list(&word_list_text)?;
    let word_count = compiled.info.word_count;
    let node_count = compiled.info.node_count;
    let byte_size = compiled.info.byte_size;

    let gaddag = gaddag::Gaddag::from_le_bytes(&compiled.binary_bytes);
    solver::set_custom_gaddag(gaddag);

    Ok(CustomGaddagResult {
        success: true,
        word_count,
        node_count,
        byte_size,
        message: format!(
            "Successfully compiled {} words into {} GADDAG nodes ({:.2} MB).",
            word_count,
            node_count,
            byte_size as f64 / (1024.0 * 1024.0)
        ),
    })
}

#[tauri::command]
fn get_leave_weights_map() -> std::collections::HashMap<String, f32> {
    equity::get_custom_weights()
}

#[tauri::command]
fn set_custom_leave_weight(leave: String, weight: f32) -> bool {
    equity::set_custom_weight(&leave, weight);
    true
}

#[tauri::command]
fn import_leave_weights(json_str: String) -> Result<usize, String> {
    equity::import_custom_weights_json(&json_str)
}

#[tauri::command]
fn export_leave_weights() -> String {
    equity::export_custom_weights_json()
}

#[tauri::command]
fn reset_leave_weights() -> bool {
    equity::reset_custom_weights();
    true
}

#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
pub struct SystemSpecs {
    pub cpu_arch: String,
    pub logical_cores: usize,
    pub active_workers: usize,
    pub simd_feature: String,
    pub os: String,
}

#[tauri::command]
fn get_system_specs() -> SystemSpecs {
    let logical_cores = std::thread::available_parallelism()
        .map(|n| n.get())
        .unwrap_or(8);
    let active_workers = solver::get_worker_threads();

    let cpu_arch = if cfg!(target_arch = "aarch64") {
        "Apple Silicon (ARM64)"
    } else if cfg!(target_arch = "x86_64") {
        "x86_64 (Intel / AMD)"
    } else {
        "Standard Architecture"
    };

    let os = if cfg!(target_os = "macos") {
        "macOS"
    } else if cfg!(target_os = "linux") {
        "Linux"
    } else if cfg!(target_os = "windows") {
        "Windows"
    } else {
        "Desktop OS"
    };

    let simd = if cfg!(target_arch = "aarch64") {
        "NEON 128-bit SIMD Vector Acceleration"
    } else {
        "AVX2 / SSE4.2 SIMD Vector Acceleration"
    };

    SystemSpecs {
        cpu_arch: cpu_arch.to_string(),
        logical_cores,
        active_workers,
        simd_feature: simd.to_string(),
        os: os.to_string(),
    }
}

#[tauri::command]
fn set_worker_threads(threads: usize) -> usize {
    solver::set_worker_threads(threads)
}

#[tauri::command]
fn get_bayesian_rack_inference(
    last_word: Option<String>,
    last_score: Option<i16>,
    had_open_3w: Option<bool>,
    had_open_bingo: Option<bool>,
    unseen_tiles: Option<String>,
) -> Vec<inference::TileBayesianInference> {
    let ctx = match (last_word, last_score) {
        (Some(w), Some(s)) if !w.is_empty() => Some(inference::OpponentPlayContext {
            word: w,
            score: s,
            had_open_3w: had_open_3w.unwrap_or(false),
            had_open_bingo_lane: had_open_bingo.unwrap_or(false),
        }),
        _ => None,
    };

    let mut unseen_counts = [0u8; 27];
    if let Some(pool) = unseen_tiles {
        for ch in pool.chars() {
            if ch == '?' {
                unseen_counts[26] = unseen_counts[26].saturating_add(1);
            } else if ch.is_ascii_alphabetic() {
                let code = (ch.to_ascii_uppercase() as u8) - b'A';
                if (code as usize) < 26 {
                    unseen_counts[code as usize] = unseen_counts[code as usize].saturating_add(1);
                }
            }
        }
    } else {
        unseen_counts = solver::STANDARD_DISTRIBUTION;
    }

    inference::get_detailed_bayesian_inference(ctx.as_ref(), &unseen_counts)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let num_threads = std::thread::available_parallelism()
        .map(|p| p.get())
        .unwrap_or(8)
        .saturating_sub(1)
        .max(1);

    solver::set_worker_threads(num_threads);

    let _ = rayon::ThreadPoolBuilder::new()
        .num_threads(num_threads)
        .build_global();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            solve_board,
            cancel_current_solve,
            check_word,
            get_word_hooks,
            find_rack_anagrams,
            evaluate_tile_exchange,
            find_best_exchange,
            steebot_choose_move,
            compile_and_load_custom_gaddag,
            get_leave_weights_map,
            set_custom_leave_weight,
            import_leave_weights,
            export_leave_weights,
            reset_leave_weights,
            get_system_specs,
            set_worker_threads,
            get_bayesian_rack_inference,
            get_word_definition
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::{check_word, get_word_hooks, get_word_definition};

    #[test]
    fn test_get_word_definition() {
        let qi_def = get_word_definition("QI".to_string(), None);
        assert!(qi_def.is_some(), "QI definition should be found");
        assert!(qi_def.unwrap().contains("Chinese philosophy"));

        let za_def = get_word_definition("za".to_string(), None);
        assert!(za_def.is_some(), "ZA definition should be found");
        assert!(za_def.unwrap().contains("pizza"));

        let non_word = get_word_definition("ZZZZZ".to_string(), None);
        assert!(non_word.is_none(), "Non-word should return None");
    }

    #[test]
    fn test_check_word_twl06() {
        assert!(check_word("QUIZ".to_string(), Some("twl06".to_string())));
        assert!(check_word("QI".to_string(), Some("twl06".to_string())));
        assert!(!check_word("ZZZZ".to_string(), Some("twl06".to_string())));
    }

    #[test]
    fn test_get_word_hooks_twl06() {
        let hooks = get_word_hooks("LANE".to_string(), Some("twl06".to_string()));
        assert!(hooks.front.contains(&'P'), "PLANE should be a front hook");
        assert!(hooks.back.contains(&'S'), "LANES should be a back hook");
    }

    #[test]
    fn test_steebot_choose_move() {
        use super::steebot_choose_move;
        let empty_board = vec![vec![None; 15]; 15];
        let play = steebot_choose_move(
            empty_board,
            "FARMERS".to_string(),
            Some(0),
            Some(30),
            Some("twl06".to_string()),
            Some("blitz".to_string()),
        ).expect("Steebot choose move should succeed");

        assert!(play.is_some(), "Steebot should choose a valid opening move");
        let p = play.unwrap();
        assert!(p.score > 0);
        println!("Steebot opening choice: {} ({} pts) | Leave: {}", p.word, p.score, p.leave);
    }
}
