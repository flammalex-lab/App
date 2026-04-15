"""Render the daily digest as markdown. Keep it scannable — top names on top,
with collapsible detail for everything else."""
from __future__ import annotations

from datetime import date
from pathlib import Path
from typing import Any

from alpha.config import DATA_DIR


def render_digest(ranked: list[dict[str, Any]], top: int = 25) -> str:
    today = date.today().isoformat()
    lines: list[str] = [
        f"# Alpha Digest — {today}",
        "",
        f"Top {min(top, len(ranked))} ranked ideas by composite score. "
        "Each row is a single ticker with every signal stacked.",
        "",
    ]
    if not ranked:
        lines.append("_No signals in the window. Check EDGAR connectivity._")
        return "\n".join(lines)

    lines += [
        "| Rank | Ticker | Score | # Sigs | Types | Headlines |",
        "|---|---|---:|---:|---|---|",
    ]
    for i, r in enumerate(ranked[:top], start=1):
        types = ", ".join(sorted({s["type"] for s in r["signals"]}))
        heads = " / ".join(s["headline"] for s in r["signals"][:3])
        lines.append(
            f"| {i} | `{r['ticker'] or r['cik'] or '?'}` | "
            f"{r['composite_score']:.2f} | {r['signal_count']} | "
            f"{types} | {heads[:140]} |"
        )

    # Detailed section per top idea
    lines += ["", "## Details", ""]
    for i, r in enumerate(ranked[:top], start=1):
        lines += [
            f"### {i}. `{r['ticker'] or r['cik']}` — score {r['composite_score']:.2f}",
            "",
        ]
        for s in r["signals"]:
            lines += [
                f"**[{s['type']}]** {s['headline']}  ",
                f"_conf={s['confidence']:.2f}, asymmetry={s['asymmetry']:.2f}, "
                f"detected={s['detected_at']}_",
                "",
                f"> {s['rationale']}",
                "",
            ]

    lines += [
        "---",
        "",
        "## Operator checklist",
        "",
        "- [ ] Dossier each top-5 idea (10-K red flags, insider history, 13F holders).",
        "- [ ] For any spin-off: read the Form 10 Information Statement cover-to-cover.",
        "- [ ] For any 13D: check the filer's small-cap track record in the whitelist.",
        "- [ ] For insider clusters: verify cross-role diversity and $ threshold.",
        "- [ ] Pre-mortem each candidate position before sizing.",
        "- [ ] Respect the drawdown circuit-breaker (30% portfolio drop -> 2wk pause).",
    ]
    return "\n".join(lines)


def write_digest(ranked: list[dict[str, Any]], top: int = 25) -> Path:
    out_dir = DATA_DIR / "reports"
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / f"digest-{date.today().isoformat()}.md"
    path.write_text(render_digest(ranked, top=top))
    return path
