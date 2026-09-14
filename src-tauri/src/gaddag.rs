// src-tauri/src/gaddag.rs - Fast Binary GADDAG Engine

pub const REV_CODE: u8 = 26; // '#' Reversal separator

#[derive(Clone)]
pub struct Gaddag {
    pub nodes: Vec<u32>,
}

impl Gaddag {
    /// Load GADDAG from raw little-endian bytes
    pub fn from_le_bytes(bytes: &[u8]) -> Self {
        let count = bytes.len() / 4;
        let mut nodes = Vec::with_capacity(count);
        for chunk in bytes.chunks_exact(4) {
            nodes.push(u32::from_le_bytes([chunk[0], chunk[1], chunk[2], chunk[3]]));
        }
        Self { nodes }
    }

    /// Check if a word is valid in the lexicon
    pub fn is_word_valid(&self, word: &str) -> bool {
        let bytes = word.as_bytes();
        let len = bytes.len();
        if len < 2 {
            return false;
        }

        let mut codes = [0u8; 16];
        if len > 15 {
            return false;
        }

        for i in 0..len {
            let b = bytes[i];
            codes[i] = if (b'a'..=b'z').contains(&b) {
                b - b'a'
            } else if (b'A'..=b'Z').contains(&b) {
                b - b'A'
            } else {
                return false;
            };
        }

        self.is_word_valid_codes(&codes[..len])
    }

    pub fn is_word_valid_codes(&self, codes: &[u8]) -> bool {
        let len = codes.len();
        if len < 2 || self.nodes.is_empty() {
            return false;
        }

        let first_code = codes[0];
        let mut node_idx = 0usize;
        let mut child_pointer = (self.nodes[0] >> 7) as usize;
        let mut found_first = false;

        while child_pointer != 0 && child_pointer < self.nodes.len() {
            let entry = self.nodes[child_pointer];
            if (entry & 0x1f) as u8 == first_code {
                node_idx = child_pointer;
                found_first = true;
                break;
            }
            if (entry & 0x40) == 0 {
                break;
            }
            child_pointer += 1;
        }
        if !found_first {
            return false;
        }

        child_pointer = (self.nodes[node_idx] >> 7) as usize;
        let mut found_rev = false;
        while child_pointer != 0 && child_pointer < self.nodes.len() {
            let entry = self.nodes[child_pointer];
            if (entry & 0x1f) as u8 == REV_CODE {
                node_idx = child_pointer;
                found_rev = true;
                break;
            }
            if (entry & 0x40) == 0 {
                break;
            }
            child_pointer += 1;
        }
        if !found_rev {
            return false;
        }

        for i in 1..len {
            let target_code = codes[i];
            child_pointer = (self.nodes[node_idx] >> 7) as usize;
            let mut matched = false;
            while child_pointer != 0 && child_pointer < self.nodes.len() {
                let entry = self.nodes[child_pointer];
                if (entry & 0x1f) as u8 == target_code {
                    if i == len - 1 {
                        return (entry & 0x20) != 0;
                    }
                    node_idx = child_pointer;
                    matched = true;
                    break;
                }
                if (entry & 0x40) == 0 {
                    break;
                }
                child_pointer += 1;
            }
            if !matched {
                return false;
            }
        }

        false
    }

    /// Return valid 1-letter front and back hooks for the specified word
    pub fn get_hooks(&self, word: &str) -> WordHooks {
        let clean = word.trim().to_uppercase();
        if clean.is_empty() || clean.len() > 14 {
            return WordHooks {
                front: Vec::new(),
                back: Vec::new(),
            };
        }

        let mut front = Vec::new();
        let mut back = Vec::new();
        let mut test_word = String::with_capacity(clean.len() + 1);

        // Front hooks: [A-Z] + clean
        for ch in 'A'..='Z' {
            test_word.clear();
            test_word.push(ch);
            test_word.push_str(&clean);
            if self.is_word_valid(&test_word) {
                front.push(ch);
            }
        }

        // Back hooks: clean + [A-Z]
        for ch in 'A'..='Z' {
            test_word.clear();
            test_word.push_str(&clean);
            test_word.push(ch);
            if self.is_word_valid(&test_word) {
                back.push(ch);
            }
        }

        WordHooks { front, back }
    }
}

#[derive(serde::Serialize, serde::Deserialize, Debug, Clone, PartialEq, Eq)]
pub struct WordHooks {
    pub front: Vec<char>,
    pub back: Vec<char>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_gaddag_word_hooks() {
        let bytes = include_bytes!("../data/gaddag_twl06.bin");
        let gaddag = Gaddag::from_le_bytes(bytes);

        let hooks = gaddag.get_hooks("LANE");
        assert!(hooks.front.contains(&'P'), "PLANE must be a valid front hook of LANE");
        assert!(hooks.back.contains(&'S'), "LANES must be a valid back hook of LANE");
    }

    #[test]
    fn test_gaddag_lookup() {
        let bytes = include_bytes!("../data/gaddag_twl06.bin");
        let gaddag = Gaddag::from_le_bytes(bytes);

        assert!(gaddag.is_word_valid("QI"));
        assert!(gaddag.is_word_valid("qi"));
        assert!(gaddag.is_word_valid("ZA"));
        assert!(gaddag.is_word_valid("RETINA"));
        assert!(gaddag.is_word_valid("SCRABBLE"));
        assert!(gaddag.is_word_valid("ZEBRA"));

        assert!(!gaddag.is_word_valid("QZ"));
        assert!(!gaddag.is_word_valid("XYZZY"));
        assert!(!gaddag.is_word_valid("ZZZZ"));
        assert!(!gaddag.is_word_valid("A"));
    }
}

impl Gaddag {
    /// Test if a 7-letter rack contains any valid 7-letter bingo in the lexicon
    pub fn has_bingo_anagram(&self, rack_counts: &mut [u8; 26], mut wildcards: u8) -> bool {
        let child_ptr = (self.nodes[0] >> 7) as usize;
        if child_ptr == 0 {
            return false;
        }

        // Try every distinct letter on the rack as the first letter
        for first_code in 0..26u8 {
            let has_letter = rack_counts[first_code as usize] > 0;
            let has_wild = wildcards > 0;

            if !has_letter && !has_wild {
                continue;
            }

            // Find child for first_code
            let mut curr = child_ptr;
            let mut node_idx = 0usize;
            while curr != 0 && curr < self.nodes.len() {
                let entry = self.nodes[curr];
                if (entry & 0x1f) as u8 == first_code {
                    node_idx = curr;
                    break;
                }
                if (entry & 0x40) == 0 {
                    break;
                }
                curr += 1;
            }

            if node_idx == 0 {
                continue;
            }

            // Step through REV
            let mut rev_ptr = (self.nodes[node_idx] >> 7) as usize;
            let mut rev_node = 0usize;
            while rev_ptr != 0 && rev_ptr < self.nodes.len() {
                let entry = self.nodes[rev_ptr];
                if (entry & 0x1f) as u8 == REV_CODE {
                    rev_node = rev_ptr;
                    break;
                }
                if (entry & 0x40) == 0 {
                    break;
                }
                rev_ptr += 1;
            }

            if rev_node == 0 {
                continue;
            }

            // Decrement used first letter
            if has_letter {
                rack_counts[first_code as usize] -= 1;
            } else {
                wildcards -= 1;
            }

            // Search remaining 6 letters
            let found = self.search_bingo_tail(rev_node, 1, 7, rack_counts, wildcards);

            // Restore
            if has_letter {
                rack_counts[first_code as usize] += 1;
            } else {
                wildcards += 1;
            }

            if found {
                return true;
            }
        }

        false
    }

    fn search_bingo_tail(
        &self,
        node_idx: usize,
        depth: usize,
        target_len: usize,
        rack_counts: &mut [u8; 26],
        mut wildcards: u8,
    ) -> bool {
        let mut child_ptr = (self.nodes[node_idx] >> 7) as usize;
        if child_ptr == 0 || child_ptr >= self.nodes.len() {
            return false;
        }

        while child_ptr != 0 && child_ptr < self.nodes.len() {
            let entry = self.nodes[child_ptr];
            let letter_code = (entry & 0x1f) as u8;
            let has_sibling = (entry & 0x40) != 0;

            if letter_code < 26 {
                let has_letter = rack_counts[letter_code as usize] > 0;
                let has_wild = wildcards > 0;

                if has_letter || has_wild {
                    if depth + 1 == target_len {
                        if (entry & 0x20) != 0 {
                            return true;
                        }
                    } else {
                        if has_letter {
                            rack_counts[letter_code as usize] -= 1;
                        } else {
                            wildcards -= 1;
                        }

                        let found = self.search_bingo_tail(
                            child_ptr,
                            depth + 1,
                            target_len,
                            rack_counts,
                            wildcards,
                        );

                        if has_letter {
                            rack_counts[letter_code as usize] += 1;
                        } else {
                            wildcards += 1;
                        }

                        if found {
                            return true;
                        }
                    }
                }
            }

            if !has_sibling {
                break;
            }
            child_ptr += 1;
        }

        false
    }

    /// Recursively find all valid sub-words and anagrams formable from a rack of letters (min_len..=max_len)
    pub fn find_subwords(
        &self,
        rack_counts: &mut [u8; 26],
        mut wildcards: u8,
        min_len: usize,
        max_len: usize,
    ) -> Vec<String> {
        let mut results = Vec::new();
        let child_ptr = (self.nodes[0] >> 7) as usize;
        if child_ptr == 0 || child_ptr >= self.nodes.len() {
            return results;
        }

        let mut current_word = Vec::with_capacity(16);

        // Try every distinct letter on the rack as the first letter
        for first_code in 0..26u8 {
            let has_letter = rack_counts[first_code as usize] > 0;
            let has_wild = wildcards > 0;

            if !has_letter && !has_wild {
                continue;
            }

            // Find child for first_code
            let mut curr = child_ptr;
            let mut node_idx = 0usize;
            while curr != 0 && curr < self.nodes.len() {
                let entry = self.nodes[curr];
                if (entry & 0x1f) as u8 == first_code {
                    node_idx = curr;
                    break;
                }
                if (entry & 0x40) == 0 {
                    break;
                }
                curr += 1;
            }

            if node_idx == 0 {
                continue;
            }

            // Step through REV
            let mut rev_ptr = (self.nodes[node_idx] >> 7) as usize;
            let mut rev_node = 0usize;
            while rev_ptr != 0 && rev_ptr < self.nodes.len() {
                let entry = self.nodes[rev_ptr];
                if (entry & 0x1f) as u8 == REV_CODE {
                    rev_node = rev_ptr;
                    break;
                }
                if (entry & 0x40) == 0 {
                    break;
                }
                rev_ptr += 1;
            }

            if rev_node == 0 {
                continue;
            }

            if has_letter {
                rack_counts[first_code as usize] -= 1;
            } else {
                wildcards -= 1;
            }
            current_word.push((first_code + b'A') as char);

            self.collect_subwords_tail(
                rev_node,
                1,
                &mut current_word,
                rack_counts,
                wildcards,
                min_len,
                max_len,
                &mut results,
            );

            current_word.pop();
            if has_letter {
                rack_counts[first_code as usize] += 1;
            } else {
                wildcards += 1;
            }
        }

        results.sort();
        results.dedup();
        results.sort_by(|a, b| b.len().cmp(&a.len()).then_with(|| a.cmp(b)));
        results
    }

    fn collect_subwords_tail(
        &self,
        node_idx: usize,
        depth: usize,
        current_word: &mut Vec<char>,
        rack_counts: &mut [u8; 26],
        mut wildcards: u8,
        min_len: usize,
        max_len: usize,
        results: &mut Vec<String>,
    ) {
        let mut child_ptr = (self.nodes[node_idx] >> 7) as usize;
        if child_ptr == 0 || child_ptr >= self.nodes.len() {
            return;
        }

        while child_ptr != 0 && child_ptr < self.nodes.len() {
            let entry = self.nodes[child_ptr];
            let letter_code = (entry & 0x1f) as u8;
            let has_sibling = (entry & 0x40) != 0;

            if letter_code < 26 {
                let has_letter = rack_counts[letter_code as usize] > 0;
                let has_wild = wildcards > 0;

                if has_letter || has_wild {
                    let next_depth = depth + 1;
                    current_word.push((letter_code + b'A') as char);

                    if next_depth >= min_len && (entry & 0x20) != 0 {
                        results.push(current_word.iter().collect());
                    }

                    if next_depth < max_len {
                        if has_letter {
                            rack_counts[letter_code as usize] -= 1;
                        } else {
                            wildcards -= 1;
                        }

                        self.collect_subwords_tail(
                            child_ptr,
                            next_depth,
                            current_word,
                            rack_counts,
                            wildcards,
                            min_len,
                            max_len,
                            results,
                        );

                        if has_letter {
                            rack_counts[letter_code as usize] += 1;
                        } else {
                            wildcards += 1;
                        }
                    }

                    current_word.pop();
                }
            }

            if !has_sibling {
                break;
            }
            child_ptr += 1;
        }
    }
}

#[test]
fn test_has_bingo_anagram() {
    let bytes = include_bytes!("../data/gaddag_twl06.bin");
    let gaddag = Gaddag::from_le_bytes(bytes);

    let mut retinas = [0u8; 26];
    for c in "RETINAS".chars() {
        retinas[(c as u8 - b'A') as usize] += 1;
    }
    assert!(gaddag.has_bingo_anagram(&mut retinas, 0), "RETINAS should have a bingo");

    let mut bad_rack = [0u8; 26];
    for c in "QQQQQZZ".chars() {
        bad_rack[(c as u8 - b'A') as usize] += 1;
    }
    assert!(!gaddag.has_bingo_anagram(&mut bad_rack, 0), "QQQQQZZ cannot have a bingo");

    let mut blank_rack = [0u8; 26];
    for c in "RETINA".chars() {
        blank_rack[(c as u8 - b'A') as usize] += 1;
    }
    assert!(gaddag.has_bingo_anagram(&mut blank_rack, 1), "RETINA + ? must form a bingo");
}

#[test]
fn test_find_subwords() {
    let bytes = include_bytes!("../data/gaddag_twl06.bin");
    let gaddag = Gaddag::from_le_bytes(bytes);

    let mut retinas = [0u8; 26];
    for c in "RETINAS".chars() {
        retinas[(c as u8 - b'A') as usize] += 1;
    }
    let words = gaddag.find_subwords(&mut retinas, 0, 2, 7);
    assert!(!words.is_empty(), "Should find subwords from RETINAS");
    assert!(words.contains(&"RETINAS".to_string()), "Must contain RETINAS");
    assert!(words.contains(&"STAINER".to_string()), "Must contain STAINER");
    assert!(words.contains(&"AT".to_string()), "Must contain 2-letter AT");
}
