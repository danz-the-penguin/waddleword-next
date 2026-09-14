# WaddleWord Next 🐧

> **A Tournament-Grade Crossword Game Engine, AI Sparring Suite & Strategic Analyzer** wrapped in an authentic, nostalgic Windows 98 desktop aesthetic.

[![Rust](https://img.shields.io/badge/Rust-1.77%2B-orange.svg?style=flat&logo=rust)](https://www.rust-lang.org/)
[![Tauri v2](https://img.shields.io/badge/Tauri-v2-blue.svg?style=flat&logo=tauri)](https://v2.tauri.app/)
[![React 19](https://img.shields.io/badge/React-19-61dafb.svg?style=flat&logo=react)](https://react.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

## 🌟 Overview

**WaddleWord Next** is an ultra-fast competitive Scrabble analysis engine and interactive training platform. Powered by a high-performance **Rust** computational core connected via **Tauri v2** to a responsive **React 19** frontend, it delivers grandmaster-level strategic analysis, real-time board evaluation, and sparring against calibrated AI personas modeled after competitive tournament platforms.

All of this computational power is wrapped in a meticulously crafted **Windows 98 classic GUI**—complete with 3D beveled insets, period-accurate system palettes, dialog boxes, and classic desktop sound effects.

---

## 🚀 Key Features

### 1. ⚡ High-Performance GADDAG Engine (Rust)
* **Deterministic Move Generation**: Implements Steven A. Gordon’s GADDAG automaton (1994) to generate all legally playable words across all 225 board squares in sub-millisecond time.
* **Comprehensive Lexicon Support**:
  * **NWL2023 / TWL06** (North American Scrabble Players Association)
  * **CSW24 / CSW21 / SOWPODS** (WESPA International English)
* **Pre-Compiled Binary DAGs**: Compact, memory-mapped graphs loaded in $< 35\text{ MB}$ of RAM.

### 2. 🤖 Woogles.io AI Sparring Ladder
Spar in head-to-head match play with automated tournament tile bags, rack draws, and live turn-by-turn coaching equity feedback:

| Bot Profile | Woogles Pt Avg | Engine Architecture | Strategy & Play Style |
| :--- | :---: | :--- | :--- |
| ⚡ **HastyBot** | **460** | Championship M1 (300 Playouts, 2-Ply) | World Championship caliber. Deep multi-ply rollouts, exact win probabilities, flawless endgame minimax. |
| 🤖 **STEEBot** | **410** | Deep M1 (120 Playouts, 2-Ply) | Expert tournament AI. Balances high tactical board scoring with aggressive corridor defense. |
| 🧠 **BetterBot** | **370** | Standard Leave Equity & 40 Playouts | Advanced club competitor. Masters 3V/4C rack balance, blanks preservation, and clunker tile dumps. |
| ⚖️ **BasicBot** | **330** | Balanced 1-Ply Evaluation | Intermediate club player. Fundamental word formation and open-board scoring. |
| 🐣 **BeginnerBot** | **240** | Greedy Score Maximizer (Blitz) | Casual learner AI. Maximizes immediate board points; great for beginners practicing rack anagrams. |

### 3. 🧠 Strategic Equity & Bayesian Opponent Modeling
* **Non-Linear Leave Equity Matrix**: Derived from machine-learned Quackle leave valuations, penalizing consonant/vowel extremes (5V, 6C) and duplicate high-value tiles (`VV`, `WW`, `II`).
* **Bingo Stem Retention**: Recognizes and rewards premier 6-, 5-, and 4-letter stems (`TISANE`, `RETINA`, `SATIRE`, `STALE`, `RAISE`, `LANE`, `SEAT`).
* **Bayesian Negative Inference**: Calculates probabilities of tiles remaining in the opponent's rack based on open Triple-Word lines or bingo runways the opponent failed to exploit.
* **Terminal Endgame Minimax**: Full Negamax solver with Alpha-Beta pruning and Zobrist Hashing transposition table to guarantee mathematically optimal outplay when the tile bag is empty.

### 4. 🎮 Studio Analysis & Game Review Tools
* **Live Turn Equity Gap**: Instant classification of every played move (`Grandmaster`, `Good`, `Inaccuracy`, `Mistake`, `Blunder`).
* **Interactive Post-Match Coaching**: Full turn-by-turn timeline with review charts, conceded equity loss tracking, and missed bingo stems.
* **GCG Match Importer & Exporter**: Open, analyze, and save tournament `.gcg` logs from Woogles.io, Cross-Tables.com, or Quackle.
* **Tactical Blunder Shield**: Optional modal warning system preventing disastrous board plays or opening 9X/4X setups.
* **Auxiliary Tools**: Visual Bingo Radar HUD, Rack Anagram Explorer, Word Referee Hook Lookup, and Tournament Chess Clock.

### 5. 👑 Grandmaster M1 Simulation & Zero-Allocation Rollouts
* **15,000 Exact Playouts**: Simulates 25 candidate plays $\times$ 300 Bayesian opponent draws $\times$ 2 plies with zero mathematical compromises, retaining true Grandmaster strength (460 Pt Avg).
* **Zero-Allocation Scorer (`FastMoveScanner`)**: Directly evaluates candidate words and scores across GADDAG graph nodes without heap allocations, reducing 15,000-solve runtimes from 3.5s to ~300ms.
* **Microsecond Atomic Solve Cancellation (`ACTIVE_SOLVE_ID`)**: Typing any letter halts background rollouts instantly, preventing compounding worker queues.
* **Reserved GUI CPU Core**: Rayon thread pool reserves 1 dedicated logical core for macOS/Linux/Windows window managers and 60 FPS WebKit rendering.

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `Ctrl + N` | Start a New Game |
| `Ctrl + O` | Open / Import `.gcg` Match File |
| `Ctrl + S` | Export Match as `.gcg` |
| `Ctrl + Z` / `Ctrl + Y` | Undo / Redo board move |
| `Ctrl + F` | Open Word Referee / Dictionary Lookup |
| `Ctrl + T` | Open Anagram Explorer Studio |
| `Ctrl + E` | Open Endgame Explorer |
| `Shift + Ctrl + C` | Open Board Snapshot (Clipboard / PNG Export) |
| `↑` / `↓` | Cycle through recommended candidate moves |
| `Enter` | Commit highlighted candidate move to the board |
| `Esc` | Clear hovered/highlighted play preview |

---

## 🛠️ Development & Build Setup

### Prerequisites
* **Node.js** (v18+ recommended)
* **Rust** (stable toolchain: `cargo`, `rustc`)
* **Tauri v2 CLI prerequisites** for your OS ([Tauri Prerequisites Guide](https://v2.tauri.app/start/prerequisites/))

### Installation

```bash
# Clone the repository
git clone https://github.com/danz-the-penguin/waddleword-next.git
cd waddleword-next

# Install Node dependencies
npm install
```

### Running Locally

```bash
# Run in development mode
npm run tauri dev

# Run with Rust compiler release optimizations (recommended for Grandmaster M1 simulations)
npm run tauri dev -- --release
```

### Running Tests

```bash
# Run frontend production build
npm run build

# Run Rust engine unit tests (32/32 comprehensive test suite)
cd src-tauri
cargo test
```

---

## 🤝 Credits & Acknowledgments

WaddleWord Next stands on the shoulders of giants in the computer science and competitive word game communities:

* **[Woogles.io](https://woogles.io)**: For the open platform, UI workflows, tournament archives, and the official 5-bot sparring ladder benchmarks credited herein.
* **Steven A. Gordon (1994)**: For formulating the GADDAG data structure that powers our deterministic move generator.
* **Quackle**: The open-source crossword AI reference for leave equity calibrations and M1 simulation mechanics.
* **Kamil Mielnik**: Pioneer of open-source web board solvers.
* **Albert Zobrist**: For Zobrist Hashing used in our endgame transposition tables.
* **Sierra On-Line (Hoyle Classic Games)**: Design inspiration for the nostalgic Windows 98 aesthetic.

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
