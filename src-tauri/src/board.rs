// src-tauri/src/board.rs - Board Representation, Multipliers, and Cross Checks

use crate::gaddag::Gaddag;

pub const ALL_LETTERS_MASK: u32 = 0x03FF_FFFF; // 26 bits for letters A-Z

pub const LETTER_SCORES: [i16; 26] = [
    1, 3, 3, 2, 1, 4, 2, 4, 1, 8, 5, 1, 3, 1, 1, 3, 10, 1, 1, 1, 1, 4, 4, 8, 4, 10,
];

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Premium {
    None,
    DoubleLetter, // 2L
    TripleLetter, // 3L
    DoubleWord,   // 2W / Center
    TripleWord,   // 3W
}

pub const BOARD_PREMIUMS: [Premium; 225] = {
    let mut grid = [Premium::None; 225];

    // 3W squares
    let tw = [(0,0), (0,7), (0,14), (7,0), (7,14), (14,0), (14,7), (14,14)];
    let mut i = 0;
    while i < tw.len() {
        grid[tw[i].0 * 15 + tw[i].1] = Premium::TripleWord;
        i += 1;
    }

    // 2W squares (including center 7,7)
    let dw = [
        (1,1), (2,2), (3,3), (4,4), (1,13), (2,12), (3,11), (4,10),
        (13,1), (12,2), (11,3), (10,4), (13,13), (12,12), (11,11), (10,10),
        (7,7),
    ];
    let mut i = 0;
    while i < dw.len() {
        grid[dw[i].0 * 15 + dw[i].1] = Premium::DoubleWord;
        i += 1;
    }

    // 3L squares
    let tl = [
        (1,5), (1,9), (5,1), (5,5), (5,9), (5,13),
        (9,1), (9,5), (9,9), (9,13), (13,5), (13,9),
    ];
    let mut i = 0;
    while i < tl.len() {
        grid[tl[i].0 * 15 + tl[i].1] = Premium::TripleLetter;
        i += 1;
    }

    // 2L squares
    let dl = [
        (0,3), (0,11), (2,6), (2,8), (3,0), (3,7), (3,14),
        (6,2), (6,6), (6,8), (6,12), (7,3), (7,11),
        (8,2), (8,6), (8,8), (8,12), (11,0), (11,7), (11,14),
        (12,6), (12,8), (14,3), (14,11),
    ];
    let mut i = 0;
    while i < dl.len() {
        grid[dl[i].0 * 15 + dl[i].1] = Premium::DoubleLetter;
        i += 1;
    }

    grid
};

#[derive(Clone, Debug)]
pub struct Board {
    pub tiles: [u8; 225],        // 0 = empty, 1..=26 for 'a'..='z'
    pub is_blank: [bool; 225],   // true if tile placed was a blank (0 points)
    pub is_anchor: [bool; 225],
    pub cross_mask_v: [u32; 225],
    pub cross_score_base_v: [i16; 225],
    pub has_perp_v: [bool; 225],
    pub cross_mask_h: [u32; 225],
    pub cross_score_base_h: [i16; 225],
    pub has_perp_h: [bool; 225],
}

impl Default for Board {
    fn default() -> Self {
        Self::new()
    }
}

impl Board {
    pub fn new() -> Self {
        let mut b = Self {
            tiles: [0; 225],
            is_blank: [false; 225],
            is_anchor: [false; 225],
            cross_mask_v: [ALL_LETTERS_MASK; 225],
            cross_score_base_v: [0; 225],
            has_perp_v: [false; 225],
            cross_mask_h: [ALL_LETTERS_MASK; 225],
            cross_score_base_h: [0; 225],
            has_perp_h: [false; 225],
        };
        b.is_anchor[7 * 15 + 7] = true;
        b
    }

    #[inline]
    pub fn is_empty(&self) -> bool {
        self.tiles.iter().all(|&t| t == 0)
    }

    pub fn set_tile(&mut self, row: usize, col: usize, letter: char, is_blank: bool) {
        let code = if ('a'..='z').contains(&letter) {
            (letter as u8 - b'a') + 1
        } else if ('A'..='Z').contains(&letter) {
            (letter as u8 - b'A') + 1
        } else {
            return;
        };
        let idx = row * 15 + col;
        self.tiles[idx] = code;
        self.is_blank[idx] = is_blank;
    }

    /// Recompute anchors, cross-checks, and perpendicular score bases
    pub fn prepare_solver(&mut self, gaddag: &Gaddag) {
        self.is_anchor.fill(false);
        self.cross_mask_v.fill(ALL_LETTERS_MASK);
        self.cross_score_base_v.fill(0);
        self.has_perp_v.fill(false);
        self.cross_mask_h.fill(ALL_LETTERS_MASK);
        self.cross_score_base_h.fill(0);
        self.has_perp_h.fill(false);

        let mut has_tiles = false;
        for i in 0..225 {
            if self.tiles[i] != 0 {
                has_tiles = true;
                break;
            }
        }

        if !has_tiles {
            self.is_anchor[7 * 15 + 7] = true;
            return;
        }

        let mut perp_buf = [0u8; 16];

        for r in 0..15 {
            for c in 0..15 {
                let idx = r * 15 + c;
                if self.tiles[idx] != 0 {
                    // Mark orthogonal neighbors as anchors
                    if r > 0 && self.tiles[(r - 1) * 15 + c] == 0 {
                        self.is_anchor[(r - 1) * 15 + c] = true;
                    }
                    if r < 14 && self.tiles[(r + 1) * 15 + c] == 0 {
                        self.is_anchor[(r + 1) * 15 + c] = true;
                    }
                    if c > 0 && self.tiles[r * 15 + (c - 1)] == 0 {
                        self.is_anchor[r * 15 + (c - 1)] = true;
                    }
                    if c < 14 && self.tiles[r * 15 + (c + 1)] == 0 {
                        self.is_anchor[r * 15 + (c + 1)] = true;
                    }
                    continue;
                }

                // Empty square: compute vertical cross-check
                let mut up = r as isize - 1;
                let mut up_count = 0;
                let mut score_v = 0i16;
                while up >= 0 && self.tiles[up as usize * 15 + c] != 0 {
                    up_count += 1;
                    up -= 1;
                }
                for k in 0..up_count {
                    let g_idx = (r - up_count + k) * 15 + c;
                    let code = self.tiles[g_idx] - 1;
                    perp_buf[k] = code;
                    score_v += if self.is_blank[g_idx] { 0 } else { LETTER_SCORES[code as usize] };
                }

                let mut down = r + 1;
                let mut down_count = 0;
                while down < 15 && self.tiles[down * 15 + c] != 0 {
                    let g_idx = down * 15 + c;
                    let code = self.tiles[g_idx] - 1;
                    perp_buf[up_count + 1 + down_count] = code;
                    score_v += if self.is_blank[g_idx] { 0 } else { LETTER_SCORES[code as usize] };
                    down_count += 1;
                    down += 1;
                }

                let perp_len_v = up_count + 1 + down_count;
                if perp_len_v > 1 {
                    self.has_perp_v[idx] = true;
                    self.cross_score_base_v[idx] = score_v;
                    let mut mask = 0u32;
                    for code in 0..26u8 {
                        perp_buf[up_count] = code;
                        if gaddag.is_word_valid_codes(&perp_buf[..perp_len_v]) {
                            mask |= 1 << code;
                        }
                    }
                    self.cross_mask_v[idx] = mask;
                }

                // Horizontal cross-check
                let mut left = c as isize - 1;
                let mut left_count = 0;
                let mut score_h = 0i16;
                while left >= 0 && self.tiles[r * 15 + left as usize] != 0 {
                    left_count += 1;
                    left -= 1;
                }
                for k in 0..left_count {
                    let g_idx = r * 15 + (c - left_count + k);
                    let code = self.tiles[g_idx] - 1;
                    perp_buf[k] = code;
                    score_h += if self.is_blank[g_idx] { 0 } else { LETTER_SCORES[code as usize] };
                }

                let mut right = c + 1;
                let mut right_count = 0;
                while right < 15 && self.tiles[r * 15 + right] != 0 {
                    let g_idx = r * 15 + right;
                    let code = self.tiles[g_idx] - 1;
                    perp_buf[left_count + 1 + right_count] = code;
                    score_h += if self.is_blank[g_idx] { 0 } else { LETTER_SCORES[code as usize] };
                    right_count += 1;
                    right += 1;
                }

                let perp_len_h = left_count + 1 + right_count;
                if perp_len_h > 1 {
                    self.has_perp_h[idx] = true;
                    self.cross_score_base_h[idx] = score_h;
                    let mut mask = 0u32;
                    for code in 0..26u8 {
                        perp_buf[left_count] = code;
                        if gaddag.is_word_valid_codes(&perp_buf[..perp_len_h]) {
                            mask |= 1 << code;
                        }
                    }
                    self.cross_mask_h[idx] = mask;
                }
            }
        }
    }
}
