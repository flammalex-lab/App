"""Command-line interface.

The production commands (use these):
    alpha init               — create data dirs + DB
    alpha scan               — daily scan: detect new spin-offs, update queue
    alpha step               — paper-trade one day (closes due, deploys ready)
    alpha digest             — write today's deploy-queue briefing
    alpha performance        — show paper-trading performance so far

Utilities:
    alpha thesis <accession> — LLM analyst output for one filing (requires API key)
    alpha backtest-spinoffs  — historical event study
    alpha signals            — list raw signal log (legacy)

Deprecated (kept for compatibility; will be removed):
    alpha run                — old "run all signals" flow
    alpha concentrated       — old conviction digest
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
from alpha.store import Store

app = typer.Typer(help="Alpha: spin-off deployment system.",
                   no_args_is_help=True)
console = Console()


def _setup_logging(verbose: bool) -> None:
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(
        level=level, format="%(message)s", datefmt="[%X]",
        handlers=[RichHandler(console=console, rich_tracebacks=True,
                              show_path=False)],
    )


# ---------------------------------------------------------------------------
# Production commands
# ---------------------------------------------------------------------------
@app.command()
def init() -> None:
    """Initialize data directories and database schema."""
    ensure_dirs()
    store = Store()
    from alpha.portfolio import Ledger, DeployQueue
    Ledger()
    DeployQueue()
    console.print(f"[green]Initialized at {store.path}[/green]")
    console.print(f"[green]Data dir: {DATA_DIR}[/green]")


@app.command()
def scan(
    since_days: int = typer.Option(60, "--since",
                                    help="Lookback window for Form 10 filings."),
    verbose: bool = typer.Option(False, "--verbose", "-v"),
) -> None:
    """Daily scan: find new Form 10s, update deploy queue."""
    _setup_logging(verbose)
    ensure_dirs()
    from datetime import timedelta
    from alpha.spinoffs import detect_spinoffs
    from alpha.portfolio import DeployQueue

    edgar = EdgarClient()
    queue = DeployQueue()
    added = 0
    seen = 0
    since = date.today() - timedelta(days=since_days)
    for cand in detect_spinoffs(edgar, since=since):
        seen += 1
        if queue.upsert(cand):
            added += 1
            console.print(f"[cyan]+[/cyan] {cand.pretty_headline}")
    stale = queue.mark_stale()
    console.print(f"[green]scanned={seen} added={added} stale={stale}[/green]")


@app.command("scan-microcap")
def scan_microcap(
    verbose: bool = typer.Option(False, "--verbose", "-v"),
) -> None:
    """Quarterly scan: find negative-EV microcaps, update deploy queue.

    Run ~4x/year after filing seasons (late Feb, May, Aug, Nov).
    Takes 1-3 hours for the full universe (~5-6K CIKs).
    Fundamentals are cached; subsequent runs are much faster.
    """
    _setup_logging(verbose)
    ensure_dirs()
    from alpha.microcap import scan_microcap_candidates
    from alpha.portfolio import DeployQueue

    edgar = EdgarClient()
    queue = DeployQueue()
    added = 0
    seen = 0
    for cand in scan_microcap_candidates(edgar):
        seen += 1
        if queue.upsert_microcap(cand):
            added += 1
            console.print(f"[magenta]+[/magenta] {cand.pretty_headline}")
    console.print(
        f"[green]microcap scan: hits={seen} added={added}[/green]"
    )


@app.command()
def step(
    mode: str = typer.Option("paper", "--mode",
                              help="'paper' or 'live' (live NYI)."),
    verbose: bool = typer.Option(False, "--verbose", "-v"),
) -> None:
    """Paper-trade one day: close due positions, deploy ready candidates."""
    _setup_logging(verbose)
    if mode == "live":
        console.print("[red]live mode not yet implemented[/red]")
        raise typer.Exit(1)
    from alpha.portfolio import PaperTrader
    trader = PaperTrader(mode=mode)
    summary = trader.step()
    console.print_json(data=summary)


@app.command()
def digest(
    mode: str = typer.Option("paper", "--mode"),
) -> None:
    """Write today's deploy-queue briefing."""
    from alpha.digest.deploy_queue import write_deploy_digest
    path = write_deploy_digest(mode=mode)
    console.print(f"[green]{path}[/green]")


@app.command()
def performance(
    mode: str = typer.Option("paper", "--mode"),
) -> None:
    """Show paper-trading performance on closed positions."""
    from alpha.portfolio import Ledger
    perf = Ledger().performance(mode=mode)
    if perf.get("n", 0) == 0:
        console.print("[yellow]No closed positions yet.[/yellow]")
        return
    table = Table(title=f"{mode.upper()} performance")
    for k, v in perf.items():
        if isinstance(v, float):
            if k in ("win_rate", "mean_return", "best", "worst"):
                table.add_row(k, f"{v*100:+.1f}%")
            else:
                table.add_row(k, f"{v:,.2f}")
        else:
            table.add_row(k, str(v))
    console.print(table)


@app.command()
def thesis(
    accession: str = typer.Argument(..., help="SEC accession number."),
    cik: str = typer.Option(None, "--cik",
                             help="Optional CIK (auto-looked-up otherwise)."),
    use_claude_code: bool = typer.Option(
        False, "--use-claude-code",
        help="Use Claude Code subscription instead of API key."),
) -> None:
    """LLM-generated thesis + red-flag report for a single filing."""
    from alpha.llm.thesis import write_thesis, extract_red_flags
    import os

    ensure_dirs()
    edgar = EdgarClient()

    # Resolve primary doc URL
    if not cik:
        console.print("[red]--cik required for now.[/red]")
        raise typer.Exit(1)
    subs = edgar.company_submissions(cik)
    recent = subs.get("filings", {}).get("recent", {})
    accnos = recent.get("accessionNumber", [])
    primaries = recent.get("primaryDocument", [])
    idx = None
    for i, a in enumerate(accnos):
        if a == accession:
            idx = i; break
    if idx is None:
        console.print(f"[red]Accession {accession} not found under CIK {cik}[/red]")
        raise typer.Exit(1)
    acc_nodash = accession.replace("-", "")
    cik_int = int(cik)
    url = (f"https://www.sec.gov/Archives/edgar/data/"
           f"{cik_int}/{acc_nodash}/{primaries[idx]}")
    raw = edgar._get(url, host="www.sec.gov", use_cache=True)

    # Strip HTML (same helper as scripts/llm_backfill.py)
    import re
    text = raw.decode("utf-8", errors="ignore")
    text = re.sub(r"<script[\s\S]*?</script>", " ", text, flags=re.I)
    text = re.sub(r"<style[\s\S]*?</style>", " ", text, flags=re.I)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text).strip()

    # Load client
    if use_claude_code:
        from alpha.llm.claude_code_client import ClaudeCodeClient
        client = ClaudeCodeClient()
        model = "sonnet"
    else:
        if not os.environ.get("ANTHROPIC_API_KEY"):
            console.print("[red]ANTHROPIC_API_KEY not set[/red]")
            raise typer.Exit(1)
        from anthropic import Anthropic
        client = Anthropic()
        model = os.environ.get("ALPHA_MODEL_DEEP", "claude-sonnet-4-6")

    console.print("[cyan]Writing thesis...[/cyan]")
    t = write_thesis(client, model, text)
    if not t:
        console.print("[red]Thesis generation failed.[/red]")
    else:
        console.print(f"\n[bold]{t.one_line_summary}[/bold]\n")
        console.print("[bold]Thesis:[/bold]")
        for b in t.thesis_bullets:
            console.print(f"  • {b}")
        console.print("\n[bold yellow]Risks:[/bold yellow]")
        for r in t.key_risks:
            console.print(f"  • {r}")
        if t.catalysts:
            console.print("\n[bold green]Catalysts:[/bold green]")
            for c in t.catalysts:
                console.print(f"  • {c}")
        if t.forced_selling_rationale:
            console.print("\n[bold magenta]Forced-selling rationale:[/bold magenta]")
            console.print(f"  {t.forced_selling_rationale}")

    console.print("\n[cyan]Scanning for dire red flags...[/cyan]")
    rf = extract_red_flags(client, model, text)
    if not rf:
        console.print("[yellow]Red-flag scan failed; proceed with caution.[/yellow]")
    else:
        hits = []
        if rf.going_concern: hits.append("going-concern qualification")
        if rf.recent_restatement: hits.append("recent restatement")
        if rf.auditor_change_last_12m: hits.append("auditor change")
        if rf.sec_investigation_disclosed: hits.append("SEC investigation")
        if rf.material_weakness_icfr: hits.append("material weakness in ICFR")
        if rf.fraud_related_litigation: hits.append("fraud litigation")
        if hits:
            console.print(f"[red]DIRE RED FLAGS: {', '.join(hits)}[/red]")
            for d in rf.details:
                console.print(f"  - {d}")
        else:
            console.print("[green]No dire red flags found.[/green]")


# ---------------------------------------------------------------------------
# Backtest utilities
# ---------------------------------------------------------------------------
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
    """[experimental] Historical activist 13D coattails study."""
    from alpha.backtest.activist_study import run_study, summarize
    df = run_study(csv_path)
    if df.empty:
        console.print("[yellow]No events completed.[/yellow]")
        return
    sm = summarize(df)
    for k, v in sm.items():
        console.print(f"[cyan]-- {k} --[/cyan]")
        console.print(v.round(4).to_string(index=False))


@app.command()
def signals(days: int = typer.Option(7, "--days", "-d")) -> None:
    """List recent raw signals (legacy; see `digest` for the new view)."""
    store = Store()
    rows = store.signals_since(days=days)
    table = Table(title=f"Signals in last {days} days")
    table.add_column("detected")
    table.add_column("type")
    table.add_column("ticker/CIK")
    table.add_column("conf", justify="right")
    table.add_column("headline", overflow="fold")
    for r in rows[:200]:
        table.add_row(
            (r["detected_at"] or "")[:19],
            r["signal_type"] or "",
            r["ticker"] or r["cik"] or "?",
            f"{r['confidence']:.2f}" if r["confidence"] else "-",
            r["headline"] or "",
        )
    console.print(table)


# ---------------------------------------------------------------------------
# Deprecated (kept for compatibility)
# ---------------------------------------------------------------------------
@app.command()
def run(
    signal: str | None = typer.Option(None, "--signal", "-s"),
    verbose: bool = typer.Option(False, "--verbose", "-v"),
    no_llm: bool = typer.Option(False, "--no-llm"),
    top: int = typer.Option(25, "--top"),
) -> None:
    """[deprecated] Old 'run all signals' flow. Use `scan` + `step` instead."""
    console.print(
        "[yellow]`alpha run` is deprecated. Use `alpha scan` + "
        "`alpha step`.[/yellow]"
    )
    _setup_logging(verbose)
    ensure_dirs()
    from alpha.signals import ALL_SIGNALS
    from alpha.scoring import rank_signals
    from alpha.digest import write_digest
    from alpha.llm import LLMAnalyzer

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
    total = 0
    for cls in selected:
        sig_cfg = cfg.get(cls.name, {})
        inst = cls(edgar, store, llm, sig_cfg)
        total += len(inst.run())
    console.print(f"[green]Total hits: {total}[/green]")
    ranked = rank_signals(store, days=14)
    path = write_digest(ranked, top=top)
    console.print(f"[green]Digest -> {path}[/green]")


if __name__ == "__main__":
    app()
