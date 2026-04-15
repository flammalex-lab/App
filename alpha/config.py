"""Centralized configuration loading. Read from YAML + env, validated by pydantic."""
from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path
from typing import Any

import yaml
from pydantic import BaseModel, Field


ROOT = Path(__file__).resolve().parent.parent
CONFIG_DIR = ROOT / "config"
DATA_DIR = Path(os.getenv("ALPHA_DATA_DIR", ROOT / "data"))


class EdgarCfg(BaseModel):
    base_url: str
    data_url: str
    efts_url: str
    rate_limit_rps: int = 8
    cache_ttl_hours: int = 24
    user_agent: str = Field(default_factory=lambda: os.getenv("EDGAR_USER_AGENT", ""))


class SignalCfg(BaseModel):
    enabled: bool = True
    # Arbitrary per-signal knobs.
    extras: dict[str, Any] = Field(default_factory=dict)


class Settings(BaseModel):
    edgar: EdgarCfg
    signals: dict[str, dict[str, Any]]
    scoring: dict[str, Any]
    portfolio: dict[str, Any]


def _read_yaml(path: Path) -> dict[str, Any]:
    with path.open() as f:
        return yaml.safe_load(f) or {}


@lru_cache(maxsize=1)
def settings() -> Settings:
    raw = _read_yaml(CONFIG_DIR / "settings.yaml")
    raw["edgar"]["user_agent"] = os.getenv("EDGAR_USER_AGENT", "")
    return Settings(**raw)


@lru_cache(maxsize=1)
def activists() -> list[dict[str, Any]]:
    return _read_yaml(CONFIG_DIR / "activists.yaml").get("activists", [])


@lru_cache(maxsize=1)
def universe_cfg() -> dict[str, Any]:
    return _read_yaml(CONFIG_DIR / "universe.yaml")


def ensure_dirs() -> None:
    for sub in ("cache", "filings", "reports"):
        (DATA_DIR / sub).mkdir(parents=True, exist_ok=True)
