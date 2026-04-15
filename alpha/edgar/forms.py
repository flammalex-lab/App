"""SEC form types we care about, grouped by the investment signal they drive."""
from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum


class FormType(StrEnum):
    # Spin-offs & major corporate events
    FORM_10 = "10-12B"              # spin-off / carve-out registration
    FORM_10_A = "10-12B/A"
    FORM_S1 = "S-1"
    FORM_F1 = "F-1"
    EIGHT_K = "8-K"

    # Activism & ownership
    SC_13D = "SC 13D"
    SC_13D_A = "SC 13D/A"
    SC_13G = "SC 13G"

    # Insider trades
    FORM_4 = "4"
    FORM_3 = "3"
    FORM_5 = "5"

    # Tender offers
    SC_TO_I = "SC TO-I"
    SC_TO_T = "SC TO-T"
    SC_14D9 = "SC 14D9"

    # Distress & restructuring
    NT_10K = "NT 10-K"
    NT_10Q = "NT 10-Q"
    FORM_25 = "25-NSE"
    FORM_15 = "15-12B"
    T3 = "T-3"

    # Governance
    PROXY = "DEF 14A"
    PRE_PROXY = "PRE 14A"
    CONTEST = "PREC14A"   # contested proxy solicitation

    # Periodic reports
    TEN_K = "10-K"
    TEN_Q = "10-Q"


@dataclass(frozen=True)
class FormMeta:
    form: FormType
    priority: int   # 1 (highest) to 5
    signal: str


# Priority map used by the scoring layer. Lower number = more urgent.
FORM_PRIORITY: dict[FormType, FormMeta] = {
    FormType.FORM_10:    FormMeta(FormType.FORM_10,    1, "spinoff"),
    FormType.FORM_10_A:  FormMeta(FormType.FORM_10_A,  1, "spinoff"),
    FormType.SC_13D:     FormMeta(FormType.SC_13D,     1, "activist"),
    FormType.SC_13D_A:   FormMeta(FormType.SC_13D_A,   2, "activist"),
    FormType.CONTEST:    FormMeta(FormType.CONTEST,    1, "proxy_fight"),
    FormType.FORM_4:     FormMeta(FormType.FORM_4,     3, "insider"),
    FormType.EIGHT_K:    FormMeta(FormType.EIGHT_K,    2, "material_event"),
    FormType.SC_TO_I:    FormMeta(FormType.SC_TO_I,    2, "tender"),
    FormType.SC_TO_T:    FormMeta(FormType.SC_TO_T,    2, "tender"),
    FormType.NT_10K:     FormMeta(FormType.NT_10K,     3, "late_filing"),
    FormType.NT_10Q:     FormMeta(FormType.NT_10Q,     3, "late_filing"),
    FormType.T3:         FormMeta(FormType.T3,         2, "restructuring"),
    FormType.TEN_K:      FormMeta(FormType.TEN_K,      4, "periodic"),
    FormType.TEN_Q:      FormMeta(FormType.TEN_Q,      4, "periodic"),
    FormType.PROXY:      FormMeta(FormType.PROXY,      4, "governance"),
    FormType.PRE_PROXY:  FormMeta(FormType.PRE_PROXY,  3, "governance"),
}
