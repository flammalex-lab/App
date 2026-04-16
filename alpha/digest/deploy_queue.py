"""Deploy-queue digest — the operator's daily briefing.

Answers three questions:
  1. What's in my portfolio right now? (open positions, target close)
  2. What's ready to deploy today? (queue ready candidates)
  3. What's coming up soon? (queue pending by date)

Also shows backtested performance-to-date on closed positions for
paper/live modes separately.
"""
from __future__ import annotations

from datetime import date
from pathlib import Path

from alpha.config import DATA_DIR
from alpha.portfolio.ledger import Ledger
from alpha.portfolio.queue import DeployQueue


def build_deploy_digest(
    ledger: Ledger | None = None,
    queue: DeployQueue | None = None,
    *,
    mode: str = "paper",
    max_concurrent: int = 5,
) -> str:
    ledger = ledger or Ledger()
    queue = queue or DeployQueue()
    today = date.today()

    open_positions = ledger.open_positions(mode=mode, sleeve="spinoff")
    ready = queue.ready_candidates(today=today, only_tradeable=True)
    all_active = queue.all_active()
    def _ready_after_today(row) -> bool:
        rd = row["ready_date"]
        if not rd:
            return False
        if hasattr(rd, "isoformat"):
            return rd > today
        try:
            return date.fromisoformat(str(rd)) > today
        except ValueError:
            return False

    pending = [r for r in all_active
                if _ready_after_today(r) and not r["deployed_id"]]
    perf = ledger.performance(mode=mode)

    L = [
        f"# Deploy Queue — {today.isoformat()} [{mode.upper()}]", "",
        f"**{len(open_positions)}/{max_concurrent} slots filled**  "
        f"| ready-to-deploy: **{len(ready)}**  "
        f"| pending: **{len(pending)}**",
        "",
    ]

    # Section 1: open positions
    L += ["## Open positions", ""]
    if not open_positions:
        L += ["_no open positions_", ""]
    else:
        L += [
            "| # | Ticker | Company | Entry | Entry $ | Target close | Days in |",
            "|---|---|---|---|---:|---|---:|",
        ]
        for i, p in enumerate(open_positions, 1):
            entry_date = p["entry_date"]
            try:
                entry_d = date.fromisoformat(entry_date)
                days_in = (today - entry_d).days
            except Exception:  # noqa: BLE001
                days_in = "—"
            L.append(
                f"| {i} | `{p['ticker'] or '?'}` | "
                f"{p['company'] or ''} | {p['entry_date']} | "
                f"${p['entry_price']:.2f} | {p['target_close']} | {days_in} |"
            )
        L.append("")

    # Section 2: ready to deploy
    L += ["## Ready to deploy **now**", ""]
    if not ready:
        L += ["_no candidates ready today_", ""]
    else:
        L += [
            "| Ticker | Company | Size | Filed | Ready | Heuristic |",
            "|---|---|---|---|---|---|",
        ]
        for r in ready:
            L.append(
                f"| `{r['ticker'] or '?'}` | {r['company']} | "
                f"{r['size_bucket']} | {r['filed_date']} | "
                f"{r['ready_date']} | {r['heuristic_flags'] or ''} |"
            )
        L.append("")

    # Section 3: pending (coming up)
    L += ["## Pending (ready date in the future)", ""]
    if not pending:
        L += ["_no pending candidates_", ""]
    else:
        L += [
            "| Ticker | Company | Size | Filed | Ready |",
            "|---|---|---|---|---|",
        ]
        for r in pending[:15]:
            L.append(
                f"| `{r['ticker'] or '?'}` | {r['company']} | "
                f"{r['size_bucket']} | {r['filed_date']} | {r['ready_date']} |"
            )
        L.append("")

    # Section 4: performance so far
    L += ["## Performance (closed positions)", ""]
    if perf.get("n", 0) == 0:
        L += ["_no closed positions yet_", ""]
    else:
        L += [
            f"- Closed: **{perf['n']}** positions",
            f"- Win rate: **{perf['win_rate']:.1%}**",
            f"- Mean return: **{perf['mean_return']:+.1%}**",
            f"- Best: **{perf['best']:+.1%}** | Worst: **{perf['worst']:+.1%}**",
            f"- Total P&L: **${perf['total_pnl']:+,.0f}**",
            "",
        ]

    # Section 5: operator checklist
    L += [
        "---", "",
        "## Operator checklist",
        "",
        "- [ ] For each **ready-to-deploy** candidate: skim the Form 10 "
        "Information Statement (10-20 min).",
        "- [ ] Run an LLM-assisted thesis + red-flag pass (`alpha thesis "
        "<accession>`).",
        "- [ ] Check current implied volatility vs 1-year range if adding "
        "LEAPS overlay.",
        "- [ ] Verify no cross-contamination with existing positions "
        "(sector, factor, or thematic overlap).",
        "- [ ] Log the deploy decision (and reason if SKIPPING a ready "
        "candidate) in your journal.",
    ]
    return "\n".join(L)


def write_deploy_digest(mode: str = "paper") -> Path:
    out = DATA_DIR / "reports" / f"deploy-{date.today().isoformat()}.md"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(build_deploy_digest(mode=mode))
    return out
