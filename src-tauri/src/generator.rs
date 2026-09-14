// src-tauri/src/generator.rs - GADDAG Move Generator and Exact Scrabble Scoring

use crate::board::{Board, Premium, BOARD_PREMIUMS, LETTER_SCORES};
use crate::gaddag::{Gaddag, REV_CODE};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CandidatePlay {
    pub word: String,
    pub row: usize,
    pub col: usize,
    pub is_vertical: bool,
    pub score: i16,
    pub tiles_used: u8,
    pub is_bingo: bool,
    pub leave: String,
    pub leave_equity: f32,
    pub total_val: f32,
    pub bingo_prob_next_turn: f32,
    pub bingo_runway_score: f32,
    pub opp_best_reply: Option<String>,
    pub opp_best_score: i16,
    pub expected_opp_score: f32,
    pub exposes_3w: bool,
    pub opens_triple_triple: bool,
    pub opens_double_double: bool,
    pub blocks_triple_triple: bool,
    pub blocks_double_double: bool,
    pub retains_blank: bool,
    pub blank_surcharge_applied: bool,
    pub is_deterministic_opponent: bool,
    pub is_endgame_setup: bool,
    pub is_endgame_bait: bool,
    pub vc_ratio: String,
    pub rack_balance_tag: String,
    pub rack_balance_desc: String,
    pub is_exchange: bool,
    pub win_prob: f32,
    pub net_margin: f32,
}

struct MultiCorridor {
    is_vert: bool,
    line: usize,
    start: usize,
    end: usize,
    c_type: u8, // 9 (Triple-Triple) or 4 (Double-Double)
    m1: usize,
    m2: usize,
}

const MULTI_CORRIDORS: [MultiCorridor; 16] = [
    // 8 Triple-Triple (9x) Corridors
    MultiCorridor { is_vert: false, line: 0,  start: 0, end: 7,  c_type: 9, m1: 0,   m2: 7 },
    MultiCorridor { is_vert: false, line: 0,  start: 7, end: 14, c_type: 9, m1: 7,   m2: 14 },
    MultiCorridor { is_vert: false, line: 14, start: 0, end: 7,  c_type: 9, m1: 210, m2: 217 },
    MultiCorridor { is_vert: false, line: 14, start: 7, end: 14, c_type: 9, m1: 217, m2: 224 },
    MultiCorridor { is_vert: true,  line: 0,  start: 0, end: 7,  c_type: 9, m1: 0,   m2: 105 },
    MultiCorridor { is_vert: true,  line: 0,  start: 7, end: 14, c_type: 9, m1: 105, m2: 210 },
    MultiCorridor { is_vert: true,  line: 14, start: 0, end: 7,  c_type: 9, m1: 14,  m2: 119 },
    MultiCorridor { is_vert: true,  line: 14, start: 7, end: 14, c_type: 9, m1: 119, m2: 224 },

    // 8 Double-Double (4x) Corridors
    MultiCorridor { is_vert: true,  line: 4,  start: 4, end: 10, c_type: 4, m1: 64,  m2: 154 },
    MultiCorridor { is_vert: true,  line: 10, start: 4, end: 10, c_type: 4, m1: 70,  m2: 160 },
    MultiCorridor { is_vert: false, line: 4,  start: 4, end: 10, c_type: 4, m1: 64,  m2: 70 },
    MultiCorridor { is_vert: false, line: 10, start: 4, end: 10, c_type: 4, m1: 154, m2: 160 },
    MultiCorridor { is_vert: false, line: 3,  start: 3, end: 11, c_type: 4, m1: 48,  m2: 56 },
    MultiCorridor { is_vert: false, line: 11, start: 3, end: 11, c_type: 4, m1: 168, m2: 176 },
    MultiCorridor { is_vert: true,  line: 3,  start: 3, end: 11, c_type: 4, m1: 48,  m2: 168 },
    MultiCorridor { is_vert: true,  line: 11, start: 3, end: 11, c_type: 4, m1: 56,  m2: 176 },
];

pub struct MoveGenerator<'a> {
    board: &'a Board,
    gaddag: &'a Gaddag,
    rack_counts: [u8; 26],
    wildcards: u8,
    initial_wildcards: u8,
    plays: Vec<CandidatePlay>,
}

impl<'a> MoveGenerator<'a> {
    pub fn new(board: &'a Board, gaddag: &'a Gaddag, rack: &str) -> Self {
        let mut rack_counts = [0u8; 26];
        let mut wildcards = 0u8;

        for ch in rack.chars() {
            if ch == '?' {
                wildcards += 1;
            } else if ('a'..='z').contains(&ch) {
                let code = ch as u8 - b'a';
                rack_counts[code as usize] += 1;
            } else if ('A'..='Z').contains(&ch) {
                let code = ch as u8 - b'A';
                rack_counts[code as usize] += 1;
            }
        }

        Self {
            board,
            gaddag,
            rack_counts,
            wildcards,
            initial_wildcards: wildcards,
            plays: Vec::with_capacity(2048),
        }
    }

    pub fn generate_all(mut self) -> Vec<CandidatePlay> {
        // Turn-1 Opening Book Fast-Path: on an empty board, only row 7 and col 7 pass through H8
        if self.board.is_empty() {
            self.generate_line(7, false);
            self.generate_line(7, true);
            return self.plays;
        }

        for r in 0..15 {
            self.generate_line(r, false);
        }

        for c in 0..15 {
            self.generate_line(c, true);
        }

        self.plays
    }

    fn generate_line(&mut self, line_idx: usize, is_vertical: bool) {
        let mut line_tiles = [0u8; 15];
        let mut line_is_blank = [false; 15];
        let mut line_anchors = [false; 15];
        let mut line_cross_masks = [0u32; 15];
        let mut line_cross_scores = [0i16; 15];
        let mut line_has_perp = [false; 15];
        let mut line_tiles_mask = 0u16;

        let mut has_any_anchor = false;
        for i in 0..15 {
            let g_idx = if is_vertical { i * 15 + line_idx } else { line_idx * 15 + i };
            let t = self.board.tiles[g_idx];
            line_tiles[i] = t;
            line_is_blank[i] = self.board.is_blank[g_idx];
            if t != 0 {
                line_tiles_mask |= 1 << i;
            }

            let anc = self.board.is_anchor[g_idx];
            line_anchors[i] = anc;
            if anc {
                has_any_anchor = true;
            }

            if is_vertical {
                line_cross_masks[i] = self.board.cross_mask_h[g_idx];
                line_cross_scores[i] = self.board.cross_score_base_h[g_idx];
                line_has_perp[i] = self.board.has_perp_h[g_idx];
            } else {
                line_cross_masks[i] = self.board.cross_mask_v[g_idx];
                line_cross_scores[i] = self.board.cross_score_base_v[g_idx];
                line_has_perp[i] = self.board.has_perp_v[g_idx];
            }
        }

        if !has_any_anchor {
            return;
        }

        let mut placed_letters = [0u8; 15];
        let mut placed_is_blank = [false; 15];

        for anchor_pos in 0..15 {
            if !line_anchors[anchor_pos] {
                continue;
            }

            self.gen_recursive(
                anchor_pos,
                anchor_pos as isize,
                0,
                -1,
                anchor_pos,
                anchor_pos + 1,
                0,
                line_idx,
                is_vertical,
                &line_tiles,
                &line_is_blank,
                line_tiles_mask,
                &line_cross_masks,
                &line_cross_scores,
                &line_has_perp,
                &mut placed_letters,
                &mut placed_is_blank,
            );
        }
    }

    #[allow(clippy::too_many_arguments)]
    fn gen_recursive(
        &mut self,
        anchor_pos: usize,
        curr_pos: isize,
        node_idx: usize,
        direction: isize,
        min_pos: usize,
        max_pos: usize,
        tiles_used: u8,
        line_idx: usize,
        is_vertical: bool,
        line_tiles: &[u8; 15],
        line_is_blank: &[bool; 15],
        line_tiles_mask: u16,
        line_cross_masks: &[u32; 15],
        line_cross_scores: &[i16; 15],
        line_has_perp: &[bool; 15],
        placed_letters: &mut [u8; 15],
        placed_is_blank: &mut [bool; 15],
    ) {
        if node_idx != 0 {
            let entry = self.gaddag.nodes[node_idx];
            if (entry & 0x20) != 0 && tiles_used > 0 && max_pos > min_pos {
                let left_clean = min_pos == 0 || (line_tiles_mask & (1 << (min_pos - 1))) == 0;
                let right_clean = if direction > 0 {
                    curr_pos >= 15 || (line_tiles_mask & (1 << curr_pos)) == 0
                } else {
                    anchor_pos + 1 >= 15 || (line_tiles_mask & (1 << (anchor_pos + 1))) == 0
                };

                if left_clean && right_clean {
                    self.record_play(
                        min_pos,
                        max_pos,
                        tiles_used,
                        line_idx,
                        is_vertical,
                        line_tiles,
                        line_is_blank,
                        line_cross_scores,
                        line_has_perp,
                        placed_letters,
                        placed_is_blank,
                    );
                }
            }
        }

        if direction > 0 && curr_pos >= 15 {
            return;
        }

        let mut child_pointer = (self.gaddag.nodes[node_idx] >> 7) as usize;
        if child_pointer == 0 || child_pointer >= self.gaddag.nodes.len() {
            return;
        }

        while child_pointer != 0 && child_pointer < self.gaddag.nodes.len() {
            let entry = self.gaddag.nodes[child_pointer];
            let letter_code = (entry & 0x1f) as u8;
            let has_sibling = (entry & 0x40) != 0;

            if letter_code == REV_CODE {
                if direction < 0 {
                    self.gen_recursive(
                        anchor_pos,
                        anchor_pos as isize + 1,
                        child_pointer,
                        1,
                        min_pos,
                        max_pos,
                        tiles_used,
                        line_idx,
                        is_vertical,
                        line_tiles,
                        line_is_blank,
                        line_tiles_mask,
                        line_cross_masks,
                        line_cross_scores,
                        line_has_perp,
                        placed_letters,
                        placed_is_blank,
                    );
                }
            } else if letter_code < 26 {
                if (0..15).contains(&curr_pos) {
                    let pos = curr_pos as usize;
                    let existing = line_tiles[pos];

                    if existing != 0 {
                        if existing - 1 == letter_code {
                            placed_letters[pos] = letter_code;
                            placed_is_blank[pos] = line_is_blank[pos];
                            let next_min = if direction < 0 && pos < min_pos { pos } else { min_pos };
                            let next_max = if direction > 0 && pos + 1 > max_pos { pos + 1 } else { max_pos };

                            self.gen_recursive(
                                anchor_pos,
                                curr_pos + direction,
                                child_pointer,
                                direction,
                                next_min,
                                next_max,
                                tiles_used,
                                line_idx,
                                is_vertical,
                                line_tiles,
                                line_is_blank,
                                line_tiles_mask,
                                line_cross_masks,
                                line_cross_scores,
                                line_has_perp,
                                placed_letters,
                                placed_is_blank,
                            );
                        }
                    } else {
                        if (line_cross_masks[pos] & (1 << letter_code)) != 0 {
                            let has_natural = self.rack_counts[letter_code as usize] > 0;
                            let has_wildcard = self.wildcards > 0;

                            if has_natural {
                                self.rack_counts[letter_code as usize] -= 1;
                                placed_letters[pos] = letter_code;
                                placed_is_blank[pos] = false;
                                let next_min = if direction < 0 && pos < min_pos { pos } else { min_pos };
                                let next_max = if direction > 0 && pos + 1 > max_pos { pos + 1 } else { max_pos };

                                self.gen_recursive(
                                    anchor_pos,
                                    curr_pos + direction,
                                    child_pointer,
                                    direction,
                                    next_min,
                                    next_max,
                                    tiles_used + 1,
                                    line_idx,
                                    is_vertical,
                                    line_tiles,
                                    line_is_blank,
                                    line_tiles_mask,
                                    line_cross_masks,
                                    line_cross_scores,
                                    line_has_perp,
                                    placed_letters,
                                    placed_is_blank,
                                );
                                self.rack_counts[letter_code as usize] += 1;
                            }

                            if has_wildcard {
                                self.wildcards -= 1;
                                placed_letters[pos] = letter_code;
                                placed_is_blank[pos] = true;
                                let next_min = if direction < 0 && pos < min_pos { pos } else { min_pos };
                                let next_max = if direction > 0 && pos + 1 > max_pos { pos + 1 } else { max_pos };

                                self.gen_recursive(
                                    anchor_pos,
                                    curr_pos + direction,
                                    child_pointer,
                                    direction,
                                    next_min,
                                    next_max,
                                    tiles_used + 1,
                                    line_idx,
                                    is_vertical,
                                    line_tiles,
                                    line_is_blank,
                                    line_tiles_mask,
                                    line_cross_masks,
                                    line_cross_scores,
                                    line_has_perp,
                                    placed_letters,
                                    placed_is_blank,
                                );
                                self.wildcards += 1;
                            }
                        }
                    }
                }
            }

            if !has_sibling {
                break;
            }
            child_pointer += 1;
        }
    }

    #[allow(clippy::too_many_arguments)]
    fn record_play(
        &mut self,
        min_pos: usize,
        max_pos: usize,
        tiles_used: u8,
        line_idx: usize,
        is_vertical: bool,
        line_tiles: &[u8; 15],
        _line_is_blank: &[bool; 15],
        line_cross_scores: &[i16; 15],
        line_has_perp: &[bool; 15],
        placed_letters: &[u8; 15],
        placed_is_blank: &[bool; 15],
    ) {
        let mut main_word_score = 0i16;
        let mut main_word_mult = 1i16;
        let mut total_perp_score = 0i16;

        let mut word_str = String::with_capacity(max_pos - min_pos);
        let mut placed_indices = [0usize; 15];
        let mut placed_count = 0usize;
        let mut exposes_3w = false;

        for pos in min_pos..max_pos {
            let letter_code = placed_letters[pos];
            let is_blank = placed_is_blank[pos];
            let letter_char = (b'A' + letter_code) as char;
            word_str.push(if is_blank { letter_char.to_ascii_lowercase() } else { letter_char });

            let g_idx = if is_vertical { pos * 15 + line_idx } else { line_idx * 15 + pos };
            let is_fresh = line_tiles[pos] == 0;

            if is_fresh {
                placed_indices[placed_count] = g_idx;
                placed_count += 1;

                let r = g_idx / 15;
                let c = g_idx % 15;

                // Check 4 cardinal neighbors for unplayed Triple Word squares
                if (r > 0 && self.board.tiles[(r - 1) * 15 + c] == 0 && BOARD_PREMIUMS[(r - 1) * 15 + c] == Premium::TripleWord)
                    || (r < 14 && self.board.tiles[(r + 1) * 15 + c] == 0 && BOARD_PREMIUMS[(r + 1) * 15 + c] == Premium::TripleWord)
                    || (c > 0 && self.board.tiles[r * 15 + c - 1] == 0 && BOARD_PREMIUMS[r * 15 + c - 1] == Premium::TripleWord)
                    || (c < 14 && self.board.tiles[r * 15 + c + 1] == 0 && BOARD_PREMIUMS[r * 15 + c + 1] == Premium::TripleWord)
                {
                    exposes_3w = true;
                }

                let prem = BOARD_PREMIUMS[g_idx];
                let base_val = if is_blank { 0 } else { LETTER_SCORES[letter_code as usize] };

                let (let_mult, word_mult) = match prem {
                    Premium::DoubleLetter => (2, 1),
                    Premium::TripleLetter => (3, 1),
                    Premium::DoubleWord => (1, 2),
                    Premium::TripleWord => (1, 3),
                    Premium::None => (1, 1),
                };

                main_word_score += base_val * let_mult;
                main_word_mult *= word_mult;

                if line_has_perp[pos] {
                    let perp_score = (line_cross_scores[pos] + base_val * let_mult) * word_mult;
                    total_perp_score += perp_score;
                }
            } else {
                let base_val = if is_blank { 0 } else { LETTER_SCORES[letter_code as usize] };
                main_word_score += base_val;
            }
        }

        let mut total_score = main_word_score * main_word_mult + total_perp_score;
        let is_bingo = tiles_used == 7;
        if is_bingo {
            total_score += 50;
        }

        let row = if is_vertical { min_pos } else { line_idx };
        let col = if is_vertical { line_idx } else { min_pos };

        // Calculate leave string
        let remaining_counts = self.rack_counts;
        let remaining_wildcards = self.wildcards;
        let mut leave = String::new();

        for i in 0..26 {
            for _ in 0..remaining_counts[i] {
                leave.push((b'A' + i as u8) as char);
            }
        }
        for _ in 0..remaining_wildcards {
            leave.push('?');
        }

        // Multi-Multiplier Corridors (9x Triple-Triple and 4x Double-Double)
        let mut opens_triple_triple = false;
        let mut opens_double_double = false;
        let mut blocks_triple_triple = false;
        let mut blocks_double_double = false;

        for c in &MULTI_CORRIDORS {
            let mut placed_on_m1 = false;
            let mut placed_on_m2 = false;
            for i in 0..placed_count {
                let p_idx = placed_indices[i];
                if p_idx == c.m1 { placed_on_m1 = true; }
                if p_idx == c.m2 { placed_on_m2 = true; }
            }

            if placed_on_m1 || placed_on_m2 {
                if c.c_type == 9 {
                    blocks_triple_triple = true;
                } else {
                    blocks_double_double = true;
                }
                continue;
            }

            if self.board.tiles[c.m1] != 0 && self.board.tiles[c.m2] != 0 {
                continue;
            }

            let mut places_inside = false;
            let mut places_adjacent = false;

            for i in 0..placed_count {
                let p_idx = placed_indices[i];
                let pr = p_idx / 15;
                let pc = p_idx % 15;

                if c.is_vert {
                    if pc == c.line && pr >= c.start && pr <= c.end {
                        places_inside = true;
                        break;
                    }
                    if (pc + 1 == c.line || (c.line > 0 && pc == c.line - 1))
                        && pr >= c.start && pr <= c.end
                        && self.board.tiles[pr * 15 + c.line] == 0
                    {
                        places_adjacent = true;
                    }
                } else {
                    if pr == c.line && pc >= c.start && pc <= c.end {
                        places_inside = true;
                        break;
                    }
                    if (pr + 1 == c.line || (c.line > 0 && pr == c.line - 1))
                        && pc >= c.start && pc <= c.end
                        && self.board.tiles[c.line * 15 + pc] == 0
                    {
                        places_adjacent = true;
                    }
                }
            }

            if places_inside || places_adjacent {
                if c.c_type == 9 {
                    opens_triple_triple = true;
                } else {
                    opens_double_double = true;
                }
            }
        }

        let retains_blank = self.initial_wildcards > 0 && remaining_wildcards > 0;
        let used_blank = self.initial_wildcards > 0 && remaining_wildcards < self.initial_wildcards;
        let blank_surcharge_applied = used_blank && !is_bingo && total_score <= 20;

        self.plays.push(CandidatePlay {
            word: word_str,
            row,
            col,
            is_vertical,
            score: total_score,
            tiles_used,
            is_bingo,
            leave,
            leave_equity: 0.0,
            total_val: total_score as f32,
            bingo_prob_next_turn: 0.0,
            bingo_runway_score: 0.0,
            opp_best_reply: None,
            opp_best_score: 0,
            expected_opp_score: 0.0,
            exposes_3w,
            opens_triple_triple,
            opens_double_double,
            blocks_triple_triple,
            blocks_double_double,
            retains_blank,
            blank_surcharge_applied,
            is_deterministic_opponent: false,
            is_endgame_setup: false,
            is_endgame_bait: false,
            vc_ratio: String::new(),
            rack_balance_tag: String::new(),
            rack_balance_desc: String::new(),
            is_exchange: false,
            win_prob: 50.0,
            net_margin: 0.0,
        });
    }
}
