// src-tauri/src/zobrist.rs - 64-bit Zobrist Hashing for Scrabble Terminal Endgame State

use crate::board::Board;
use crate::generator::CandidatePlay;
use std::sync::OnceLock;

/// Number of board squares (15x15 = 225)
pub const NUM_SQUARES: usize = 225;
/// 0 = empty, 1..=26 = 'A'..'Z', 27 = Blank
pub const NUM_TILE_STATES: usize = 28;
/// 0..25 = 'A'..'Z', 26 = Blank ('?')
pub const NUM_RACK_LETTERS: usize = 27;
/// Max rack count for any single letter (0 to 7)
pub const MAX_RACK_COUNT: usize = 8;

pub struct ZobristTables {
    pub board: [[u64; NUM_TILE_STATES]; NUM_SQUARES],
    pub player_rack: [[u64; MAX_RACK_COUNT]; NUM_RACK_LETTERS],
    pub opp_rack: [[u64; MAX_RACK_COUNT]; NUM_RACK_LETTERS],
    pub side_to_move: u64,
    pub passes: [u64; 3], // 0, 1, or 2 consecutive passes
}

static ZOBRIST: OnceLock<ZobristTables> = OnceLock::new();

/// Deterministic SplitMix64 pseudo-random generator
struct SplitMix64(u64);

impl SplitMix64 {
    fn new(seed: u64) -> Self {
        Self(seed)
    }

    fn next_u64(&mut self) -> u64 {
        self.0 = self.0.wrapping_add(0x9e3779b97f4a7c15);
        let mut z = self.0;
        z = (z ^ (z >> 30)).wrapping_mul(0xbf58476d1ce4e5b9);
        z = (z ^ (z >> 27)).wrapping_mul(0x94d049bb133111eb);
        z ^ (z >> 31)
    }
}

pub fn get_zobrist_tables() -> &'static ZobristTables {
    ZOBRIST.get_or_init(|| {
        let mut prng = SplitMix64::new(0x5A71_10B8_C0DE_2026);
        let mut board = [[0u64; NUM_TILE_STATES]; NUM_SQUARES];
        for sq in 0..NUM_SQUARES {
            for state in 0..NUM_TILE_STATES {
                board[sq][state] = prng.next_u64();
            }
        }
        let mut player_rack = [[0u64; MAX_RACK_COUNT]; NUM_RACK_LETTERS];
        for letter in 0..NUM_RACK_LETTERS {
            for count in 0..MAX_RACK_COUNT {
                player_rack[letter][count] = prng.next_u64();
            }
        }
        let mut opp_rack = [[0u64; MAX_RACK_COUNT]; NUM_RACK_LETTERS];
        for letter in 0..NUM_RACK_LETTERS {
            for count in 0..MAX_RACK_COUNT {
                opp_rack[letter][count] = prng.next_u64();
            }
        }
        let side_to_move = prng.next_u64();
        let passes = [prng.next_u64(), prng.next_u64(), prng.next_u64()];

        ZobristTables {
            board,
            player_rack,
            opp_rack,
            side_to_move,
            passes,
        }
    })
}

/// Convert a rack string to a 27-element frequency array (0..25 = 'A'..'Z', 26 = '?')
pub fn rack_to_counts(rack: &str) -> [u8; 27] {
    let mut counts = [0u8; 27];
    for ch in rack.chars() {
        if ch == '?' || ch == '.' || ch == '*' || ch == '_' {
            counts[26] = counts[26].saturating_add(1);
        } else if ('A'..='Z').contains(&ch) {
            let idx = (ch as u8 - b'A') as usize;
            counts[idx] = counts[idx].saturating_add(1);
        } else if ('a'..='z').contains(&ch) {
            let idx = (ch as u8 - b'a') as usize;
            counts[idx] = counts[idx].saturating_add(1);
        }
    }
    counts
}

/// Map a board square to its Zobrist tile state: 0 = Empty, 1..=26 = 'A'..'Z', 27 = Blank
#[inline(always)]
pub fn get_square_state(board: &Board, sq: usize) -> usize {
    let t = board.tiles[sq];
    if t == 0 {
        0
    } else if board.is_blank[sq] {
        27
    } else {
        t as usize
    }
}

/// Compute the complete 64-bit Zobrist hash of a full board position from scratch
pub fn compute_board_hash(board: &Board) -> u64 {
    let tables = get_zobrist_tables();
    let mut hash = 0u64;
    for sq in 0..NUM_SQUARES {
        let state = get_square_state(board, sq);
        hash ^= tables.board[sq][state];
    }
    hash
}

/// Compute full 64-bit Zobrist hash for a complete game state
pub fn compute_initial_hash(
    board: &Board,
    player_rack: &str,
    opp_rack: &str,
    is_player_turn: bool,
    consecutive_passes: u8,
) -> u64 {
    let tables = get_zobrist_tables();
    let mut hash = compute_board_hash(board);

    let p_counts = rack_to_counts(player_rack);
    for letter in 0..NUM_RACK_LETTERS {
        let count = (p_counts[letter] as usize).min(MAX_RACK_COUNT - 1);
        hash ^= tables.player_rack[letter][count];
    }

    let o_counts = rack_to_counts(opp_rack);
    for letter in 0..NUM_RACK_LETTERS {
        let count = (o_counts[letter] as usize).min(MAX_RACK_COUNT - 1);
        hash ^= tables.opp_rack[letter][count];
    }

    if !is_player_turn {
        hash ^= tables.side_to_move;
    }

    let pass_idx = (consecutive_passes as usize).min(2);
    hash ^= tables.passes[pass_idx];

    hash
}

/// Incrementally update the Zobrist hash after a move is played
pub fn hash_after_play(
    current_hash: u64,
    board_before: &Board,
    play: &CandidatePlay,
    player_counts_before: &[u8; 27],
    is_player: bool,
    current_passes: u8,
) -> (u64, [u8; 27]) {
    let tables = get_zobrist_tables();
    let mut hash = current_hash;
    let mut new_counts = *player_counts_before;

    let word_bytes = play.word.as_bytes();
    for i in 0..word_bytes.len() {
        let r = if play.is_vertical { play.row + i } else { play.row };
        let c = if play.is_vertical { play.col } else { play.col + i };
        let sq = r * 15 + c;

        // If square was previously empty, we place a new tile
        if board_before.tiles[sq] == 0 {
            let b = word_bytes[i];
            let is_blank = (b'a'..=b'z').contains(&b);
            let letter_idx = if is_blank {
                26
            } else {
                ((b.to_ascii_uppercase() - b'A') as usize).min(25)
            };

            let new_tile_state = if is_blank {
                27
            } else {
                ((b.to_ascii_uppercase() - b'A' + 1) as usize).min(26)
            };

            // XOR out empty square, XOR in newly placed square
            hash ^= tables.board[sq][0];
            hash ^= tables.board[sq][new_tile_state];

            // Update rack tile counts
            let old_count = (new_counts[letter_idx] as usize).min(MAX_RACK_COUNT - 1);
            if new_counts[letter_idx] > 0 {
                new_counts[letter_idx] -= 1;
            }
            let new_count = (new_counts[letter_idx] as usize).min(MAX_RACK_COUNT - 1);

            if is_player {
                hash ^= tables.player_rack[letter_idx][old_count];
                hash ^= tables.player_rack[letter_idx][new_count];
            } else {
                hash ^= tables.opp_rack[letter_idx][old_count];
                hash ^= tables.opp_rack[letter_idx][new_count];
            }
        }
    }

    // Toggle turn
    hash ^= tables.side_to_move;

    // Reset consecutive passes to 0 upon a move
    if current_passes > 0 {
        let old_pass_idx = (current_passes as usize).min(2);
        hash ^= tables.passes[old_pass_idx];
        hash ^= tables.passes[0];
    }

    (hash, new_counts)
}

/// Incrementally update the Zobrist hash after a pass
pub fn hash_after_pass(current_hash: u64, current_passes: u8) -> u64 {
    let tables = get_zobrist_tables();
    let mut hash = current_hash;

    // Toggle turn
    hash ^= tables.side_to_move;

    // Increment consecutive passes
    let old_pass_idx = (current_passes as usize).min(2);
    let new_pass_idx = ((current_passes + 1) as usize).min(2);

    hash ^= tables.passes[old_pass_idx];
    hash ^= tables.passes[new_pass_idx];

    hash
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_zobrist_tables_initialization() {
        let tables = get_zobrist_tables();
        assert_ne!(tables.board[0][0], 0);
        assert_ne!(tables.side_to_move, 0);
        assert_ne!(tables.board[0][0], tables.board[0][1]);
        assert_ne!(tables.board[0][0], tables.board[1][0]);
    }

    #[test]
    fn test_zobrist_incremental_matches_full_hash() {
        let mut board = Board::new();
        let player_rack = "CATDOGS";
        let opp_rack = "RETINAS";
        let is_player = true;
        let passes = 0;

        let initial_hash = compute_initial_hash(&board, player_rack, opp_rack, is_player, passes);

        // Place word "CAT" at (7, 7) horizontally
        let play = CandidatePlay {
            word: "CAT".to_string(),
            row: 7,
            col: 7,
            is_vertical: false,
            score: 5,
            tiles_used: 3,
            is_bingo: false,
            leave: "DOGS".to_string(),
            leave_equity: 0.0,
            total_val: 5.0,
            bingo_prob_next_turn: 0.0,
            bingo_runway_score: 0.0,
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
            is_deterministic_opponent: true,
            is_endgame_setup: false,
            is_endgame_bait: false,
            vc_ratio: "1V/3C".to_string(),
            rack_balance_tag: "neutral".to_string(),
            rack_balance_desc: "Standard".to_string(),
            is_exchange: false,
            win_prob: 50.0,
            net_margin: 5.0,
        };

        let p_counts = rack_to_counts(player_rack);
        let (inc_hash, _new_counts) = hash_after_play(initial_hash, &board, &play, &p_counts, is_player, passes);

        // Apply manually to board
        board.set_tile(7, 7, 'C', false);
        board.set_tile(7, 8, 'A', false);
        board.set_tile(7, 9, 'T', false);

        // Turn toggles to false, remaining player rack is "DOGS"
        let expected_hash = compute_initial_hash(&board, "DOGS", opp_rack, false, 0);

        assert_eq!(inc_hash, expected_hash, "Incremental hash must match full recomputed hash exactly!");
    }

    #[test]
    fn test_zobrist_pass_cycle() {
        let board = Board::new();
        let hash0 = compute_initial_hash(&board, "A", "B", true, 0);
        let hash1 = hash_after_pass(hash0, 0);
        let hash2 = hash_after_pass(hash1, 1);

        assert_ne!(hash0, hash1);
        assert_ne!(hash1, hash2);

        // Verify full recomputation of pass states
        let expected_hash1 = compute_initial_hash(&board, "A", "B", false, 1);
        let expected_hash2 = compute_initial_hash(&board, "A", "B", true, 2);

        assert_eq!(hash1, expected_hash1);
        assert_eq!(hash2, expected_hash2);
    }
}
