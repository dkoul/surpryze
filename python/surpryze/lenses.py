"""Internal coverage lenses (do not expose external methodology names to users)."""

from typing import Literal

CoverageLens = Literal[
    "structure",
    "function",
    "data",
    "interaction",
    "platform",
    "operations",
    "time",
]

LENS_LABELS: dict[str, str] = {
    "structure": "Structure",
    "function": "Behavior",
    "data": "Data",
    "interaction": "Interaction",
    "platform": "Platform",
    "operations": "Operations",
    "time": "Time",
}


def infer_lens(signals: str) -> CoverageLens:
    s = signals.lower()
    if any(x in s for x in ("fetch", "api", "axios", "graphql", "http")):
        return "platform"
    if any(x in s for x in ("route", "router", "path", "navigate", "href")):
        return "structure"
    if any(x in s for x in ("form", "input", "submit", "button", "onclick")):
        return "interaction"
    if any(x in s for x in ("timeout", "expir", "schedule", "interval", "date")):
        return "time"
    if any(x in s for x in ("state", "store", "redux", "persist")):
        return "data"
    if any(x in s for x in ("workflow", "checkout", "step")):
        return "operations"
    return "function"
