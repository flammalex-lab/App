"""Command-line interface.

Commands:
    alpha init            — initialize DB and data directories
    alpha run             — run all signals, write digest
    alpha run --signal X  — run one specific signal
    alpha digest          — regenerate today's digest from stored signals
    alpha signals         — list recent signals
    alpha backtest        — run the reference backtest (requires prices file)
"""
from __future__ import annotations

import logging
from datetime import date
from pathlib import Path

import typer
from rich.console import Console
from rich.logging import RichHandler
from rich.table import Table

from alpha.config import DATA_DIR, ensure_dirs, settings
from alpha.edgar import EdgarClient
from alpha.llm import LLMAnalyzer
from alpha.signals import ALL_SIGNALS
from alpha.scoring import rank_signals
from alpha.store import Store
from alpha.digest import write_digest

app = typer.Typer(help="Alpha: event-driven research system.",
                   no_args_is_help=True)
console = Console()


def _setup_logging(verbose: bool) -> None:
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(
        level=level,
        format="%(message)s",
        datefmt="[%X]",
        handlers=[RichHandler(console=console, rich_tracebacks=True,
                              show_path=False)],
    )


@app.command()
def init() -> None:
    """Initialize data directories and database schema."""
    ensure_dirs()
    store = Store()
    console.print(f"[green]Initialized store at {store.path}[/green]")
    console.print(f"[green]Data dir: {DATA_DIR}[/green]")


@app.command()
def run(
    signal: str | None = typer.Option(
        None, "--signal", "-s",
        help="Run a single signal by name (default: all).",
    ),
    verbose: bool = typer.Option(False, "--verbose", "-v"),
    no_llm: bool = typer.Option(False, "--no-llm",
                                 help="Skip LLM extraction (faster; uses cache)."),
    top: int = typer.Option(25, "--top", help="Top-N rows in digest."),
) -> None:
    """Run signals, store hits, write the daily digest."""
    _setup_logging(verbose)
    ensure_dirs()

    store = Store()
    edgar = EdgarClient()
    llm = None if no_llm else LLMAnalyzer(store)

    cfg = settings().signals

    selected = ALL_SIGNALS
    if signal:
        selected = [cls for cls in ALL_SIGNALS if cls.name == signal]
        if not selected:
            raise typer.BadParameter(
                f"Unknown signal '{signal}'. "
                f"Available: {[c.name for c in ALL_SIGNALS]}"
            )

    total_hits = 0
    for cls in selected:
        sig_cfg = cfg.get(cls.name, {})
        if sig_cfg.get("enabled", True) is False:
            console.print(f"[dim]skipping disabled signal: {cls.name}[/dim]")
            continue
        console.print(f"[cyan]>> {cls.name}[/cyan]")
        inst = cls(edgar, store, llm, sig_cfg)
        hits = inst.run()
        total_hits += len(hits)
        console.print(f"   {len(hits)} hits")
    console.print(f"[green]Total hits: {total_hits}[/green]")

    ranked = rank_signals(store, days=14)
    store.write_rankings(
        run_date=date.today().isoformat(),
        rows=[{"ticker": r["ticker"], "cik": r["cik"],
               "composite_score": r["composite_score"],
               "rationale": r["rationale"]} for r in ranked[:100]],
    )
    path = write_digest(ranked, top=top)
    console.print(f"[green]Digest -> {path}[/green]")


@app.command()
def digest(top: int = typer.Option(25, "--top")) -> None:
    """Regenerate today's digest from stored signals without re-fetching."""
    ensure_dirs()
    store = Store()
    ranked = rank_signals(store, days=14)
    path = write_digest(ranked, top=top)
    console.print(f"[green]{path}[/green]")


@app.command()
def signals(days: int = typer.Option(7, "--days", "-d")) -> None:
    """List recent signals."""
    store = Store()
    rows = store.signals_since(days=days)
    table = Table(title=f"Signals in last {days} days")
    table.add_column("detected")
    table.add_column("type")
    table.add_column("ticker/CIK")
    table.add_column("conf", justify="right")
    table.add_column("asym", justify="right")
    table.add_column("headline", overflow="fold")
    for r in rows[:200]:
        table.add_row(
            r["detected_at"][:19],
            r["signal_type"],
            r["ticker"] or r["cik"] or "?",
            f"{r['confidence']:.2f}" if r["confidence"] else "-",
            f"{r['asymmetry']:.2f}" if r["asymmetry"] else "-",
            r["headline"] or "",
        )
    console.print(table)


@app.command()
def backtest(prices_path: Path = typer.Option(..., "--prices")) -> None:
    """Run the reference Magic Formula backtest on a prices parquet/csv."""
    import pandas as pd
    from alpha.backtest import Backtester, StrategyRule
    from alpha.backtest.engine import magic_formula_rank

    if prices_path.suffix == ".parquet":
        df = pd.read_parquet(prices_path)
    else:
        df = pd.read_csv(prices_path, parse_dates=["date"])
    df = df.set_index(["date", "ticker"]).sort_index()

    rule = StrategyRule(name="magic_formula", rank_fn=magic_formula_rank,
                        rebalance="Q", max_positions=25)
    bt = Backtester(df, rule)
    res = bt.run()
    console.print(res.summary())


@app.command("backtest-spinoffs")
def backtest_spinoffs(
    csv_path: Path = typer.Option(
        DATA_DIR / "historical_spinoffs.csv", "--csv",
    ),
    delay_days: int = typer.Option(21, "--delay",
                                    help="Trading-day entry delay after ex-date."),
) -> None:
    """Historical spin-off event study (free yfinance data)."""
    from alpha.backtest.spinoff_study import run_study, summarize
    df = run_study(csv_path, entry_offset_days=delay_days)
    if df.empty:
        console.print("[yellow]No events completed.[/yellow]")
        return
    sm = summarize(df)
    for k, v in sm.items():
        console.print(f"[cyan]-- {k} --[/cyan]")
        console.print(v.round(4).to_string(index=False))


@app.command("backtest-activists")
def backtest_activists(
    csv_path: Path = typer.Option(
        DATA_DIR / "historical_activist_campaigns.csv", "--csv"
    ),
) -> None:
    """Historical activist 13D coattails study."""
    from alpha.backtest.activist_study import run_study, summarize
    df = run_study(csv_path)
    if df.empty:
        console.print("[yellow]No events completed.[/yellow]")
        return
    sm = summarize(df)
    for k, v in sm.items():
        console.print(f"[cyan]-- {k} --[/cyan]")
        console.print(v.round(4).to_string(index=False))


if __name__ == "__main__":
    app()
