// src-tauri/src/gaddag_compiler.rs - High-Performance In-App GADDAG Lexicon Compiler

use std::collections::HashMap;

const REV_CODE: u8 = 26; // '#' Reversal separator

#[derive(Default)]
struct TrieNode {
    is_terminal: bool,
    children: HashMap<u8, usize>, // letter_code (0..=26) -> trie_node_index
    canonical_id: usize,
}

#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
pub struct CompiledGaddagInfo {
    pub node_count: usize,
    pub word_count: usize,
    pub byte_size: usize,
}

pub struct CompiledGaddag {
    pub binary_bytes: Vec<u8>,
    pub info: CompiledGaddagInfo,
}

/// Compiles a plaintext word list into a serialized Little-Endian GADDAG binary buffer
pub fn compile_word_list(text: &str) -> Result<CompiledGaddag, String> {
    let mut words = Vec::new();
    for line in text.lines() {
        let trimmed = line.trim();
        if trimmed.len() >= 2 && trimmed.chars().all(|c| c.is_ascii_alphabetic()) {
            words.push(trimmed.to_ascii_uppercase());
        }
    }

    if words.is_empty() {
        return Err("No valid words found. Dictionary must contain words with 2+ alphabetic letters.".to_string());
    }

    words.sort_unstable();
    words.dedup();
    let word_count = words.len();

    // 1. Build Ingest Trie with Gordon's Dual-Form Paths
    let mut trie: Vec<TrieNode> = vec![TrieNode::default()]; // root at index 0

    for word in &words {
        let bytes = word.as_bytes();
        let n = bytes.len();

        // Form 1: wn, wn-1, ..., w1 (reversed)
        let mut form1 = Vec::with_capacity(n);
        for i in (0..n).rev() {
            form1.push(bytes[i] - b'A');
        }
        insert_path(&mut trie, &form1);

        // Form 2: wi, wi-1, ..., w1, REV, wi+1, ..., wn
        for i in 1..n {
            let mut form2 = Vec::with_capacity(n + 1);
            for j in (0..i).rev() {
                form2.push(bytes[j] - b'A');
            }
            form2.push(REV_CODE);
            for j in i..n {
                form2.push(bytes[j] - b'A');
            }
            insert_path(&mut trie, &form2);
        }
    }

    // 2. Bottom-Up Subtree Minimization into DAWG (Hash Consing)
    let mut registry: HashMap<String, usize> = HashMap::new();
    let mut next_canonical_id = 1usize;
    minimize_node(&mut trie, 0, &mut registry, &mut next_canonical_id);

    // 3. Flatten Minimized DAWG into Contiguous Flat Nodes (Uint32 Array)
    let mut flat_nodes: Vec<u32> = vec![0];
    let mut queue = std::collections::VecDeque::new();
    queue.push_back((0usize, 0usize)); // (trie_idx, target_flat_idx)

    let mut child_block_pointers: HashMap<usize, usize> = HashMap::new();

    while let Some((trie_idx, target_flat_idx)) = queue.pop_front() {
        if trie[trie_idx].children.is_empty() {
            continue;
        }

        let canon_id = trie[trie_idx].canonical_id;
        if let Some(&first_child_index) = child_block_pointers.get(&canon_id) {
            flat_nodes[target_flat_idx] = (flat_nodes[target_flat_idx] & 0x7f)
                | (((first_child_index as u32) & 0x01ffffff) << 7);
            continue;
        }

        let mut child_entries: Vec<(u8, usize)> = trie[trie_idx]
            .children
            .iter()
            .map(|(&ch, &child_idx)| (ch, child_idx))
            .collect();
        child_entries.sort_unstable_by_key(|&(ch, _)| ch);

        let first_child_index = flat_nodes.len();
        child_block_pointers.insert(canon_id, first_child_index);

        flat_nodes[target_flat_idx] = (flat_nodes[target_flat_idx] & 0x7f)
            | (((first_child_index as u32) & 0x01ffffff) << 7);

        let start_idx = flat_nodes.len();
        for _ in 0..child_entries.len() {
            flat_nodes.push(0);
        }

        for (i, &(ch, child_trie_idx)) in child_entries.iter().enumerate() {
            let node_index = start_idx + i;
            let is_terminal_bit = if trie[child_trie_idx].is_terminal { 1u32 } else { 0u32 };
            let has_sibling_bit = if i < child_entries.len() - 1 { 1u32 } else { 0u32 };
            let letter_code = (ch & 0x1f) as u32;

            flat_nodes[node_index] = letter_code | (is_terminal_bit << 5) | (has_sibling_bit << 6);

            if !trie[child_trie_idx].children.is_empty() {
                queue.push_back((child_trie_idx, node_index));
            }
        }
    }

    // 4. Convert u32 slice to little-endian bytes
    let node_count = flat_nodes.len();
    let mut binary_bytes = Vec::with_capacity(node_count * 4);
    for node in flat_nodes {
        binary_bytes.extend_from_slice(&node.to_le_bytes());
    }

    let byte_size = binary_bytes.len();

    Ok(CompiledGaddag {
        binary_bytes,
        info: CompiledGaddagInfo {
            node_count,
            word_count,
            byte_size,
        },
    })
}

fn insert_path(trie: &mut Vec<TrieNode>, path: &[u8]) {
    let mut curr = 0usize;
    for &code in path {
        if let Some(&next) = trie[curr].children.get(&code) {
            curr = next;
        } else {
            let next = trie.len();
            trie.push(TrieNode::default());
            trie[curr].children.insert(code, next);
            curr = next;
        }
    }
    trie[curr].is_terminal = true;
}

fn minimize_node(
    trie: &mut [TrieNode],
    curr: usize,
    registry: &mut HashMap<String, usize>,
    next_canonical_id: &mut usize,
) -> usize {
    if trie[curr].children.is_empty() {
        let sig = if trie[curr].is_terminal { "T" } else { "F" };
        if let Some(&canon) = registry.get(sig) {
            trie[curr].canonical_id = canon;
            return canon;
        }
        let canon = *next_canonical_id;
        *next_canonical_id += 1;
        trie[curr].canonical_id = canon;
        registry.insert(sig.to_string(), canon);
        return canon;
    }

    let mut sorted_keys: Vec<u8> = trie[curr].children.keys().copied().collect();
    sorted_keys.sort_unstable();

    let mut sig = if trie[curr].is_terminal { "T:" } else { "F:" }.to_string();

    for code in sorted_keys {
        let child_idx = trie[curr].children[&code];
        let canon_child = minimize_node(trie, child_idx, registry, next_canonical_id);
        sig.push_str(&format!("{}:{},", code, canon_child));
    }

    if let Some(&canon) = registry.get(&sig) {
        trie[curr].canonical_id = canon;
        canon
    } else {
        let canon = *next_canonical_id;
        *next_canonical_id += 1;
        trie[curr].canonical_id = canon;
        registry.insert(sig, canon);
        canon
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::gaddag::Gaddag;

    #[test]
    fn test_custom_gaddag_compiler() {
        let word_list = "CAT\nDOG\nBAT\nLANE\nPLAN\nPLANE\n";
        let compiled = compile_word_list(word_list).expect("Compilation must succeed");

        assert_eq!(compiled.info.word_count, 6);
        assert!(compiled.info.node_count > 10);
        assert_eq!(compiled.binary_bytes.len(), compiled.info.node_count * 4);

        let gaddag = Gaddag::from_le_bytes(&compiled.binary_bytes);

        // Validation checks
        assert!(gaddag.is_word_valid("CAT"));
        assert!(gaddag.is_word_valid("cat"));
        assert!(gaddag.is_word_valid("DOG"));
        assert!(gaddag.is_word_valid("BAT"));
        assert!(gaddag.is_word_valid("LANE"));
        assert!(gaddag.is_word_valid("PLANE"));

        assert!(!gaddag.is_word_valid("PIG"));
        assert!(!gaddag.is_word_valid("BIRD"));
        assert!(!gaddag.is_word_valid("BOG"));

        // Hook checks on custom compiled GADDAG
        let hooks = gaddag.get_hooks("LANE");
        assert!(hooks.front.contains(&'P'), "PLANE is in word list, so P must be a front hook for LANE");
    }
}
