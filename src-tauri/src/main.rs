// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    let num_threads = std::thread::available_parallelism()
        .map(|p| p.get())
        .unwrap_or(8)
        .saturating_sub(1)
        .max(1);

    waddleword_next_lib::solver::set_worker_threads(num_threads);

    let _ = rayon::ThreadPoolBuilder::new()
        .num_threads(num_threads)
        .build_global();

    waddleword_next_lib::run()
}
