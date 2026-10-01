from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from surpryze.gap_analysis import run_gap_analysis, write_gap_markdown
from surpryze.react_scan import scan_react_repo


def cmd_scan(args: argparse.Namespace) -> int:
    react_root = Path(args.react_repo).resolve()
    out = Path(args.output).resolve() if args.output else Path("assumption-graph.json").resolve()
    graph = scan_react_repo(react_root)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(graph, indent=2), encoding="utf-8")
    n = graph["projectSummary"]["assumptions"]
    print(f"Wrote {n} assumptions → {out}")
    return 0


def cmd_gap(args: argparse.Namespace) -> int:
    test_root = Path(args.test_repo).resolve()
    graph_path = Path(args.graph_file).resolve()
    if not graph_path.is_file():
        print(f"Graph file not found: {graph_path}", file=sys.stderr)
        return 1

    report = run_gap_analysis(test_root, graph_path)
    out_json = Path(args.output).resolve() if args.output else Path("gap-analysis.json").resolve()
    out_md = out_json.with_suffix(".md")

    out_json.parent.mkdir(parents=True, exist_ok=True)
    out_json.write_text(json.dumps(report, indent=2), encoding="utf-8")
    write_gap_markdown(report, out_md)

    print(
        f"Gaps: {report['summary']['gaps']} / {report['summary']['assumptions']} assumptions "
        f"({report['summary']['uiTests']} UI tests)"
    )
    print(f"Wrote {out_json}")
    print(f"Wrote {out_md}")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="surpryze",
        description="Surpryze Python CLI — React assumption graph and UI test gap analysis",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    scan_p = sub.add_parser("scan", help="Scan React repo → assumption graph JSON")
    scan_p.add_argument("react_repo", help="Path to React application repository")
    scan_p.add_argument(
        "-o",
        "--output",
        help="Output graph JSON path (default: ./assumption-graph.json)",
    )
    scan_p.set_defaults(func=cmd_scan)

    gap_p = sub.add_parser("gap", help="Match UI tests to graph → gap analysis")
    gap_p.add_argument("test_repo", help="Path to Playwright/Cypress/Selenium test repository")
    gap_p.add_argument("graph_file", help="Path to assumption graph JSON from scan")
    gap_p.add_argument(
        "-o",
        "--output",
        help="Output gap JSON path (default: ./gap-analysis.json; also writes .md)",
    )
    gap_p.set_defaults(func=cmd_gap)

    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
