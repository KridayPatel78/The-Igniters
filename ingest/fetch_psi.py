"""Download PSI investigation JSON + experimental-table CSVs into data/raw/.

Usage:
    python -m ingest.fetch_psi                      # all IDs in ingest/psi_ids.txt
    python -m ingest.fetch_psi --ids PSI-98 PSI-26  # only these
    python -m ingest.fetch_psi --force              # re-download even if cached

Polite by design: one session, sequential, 1 s between every HTTP request, cached.
Only the investigation JSON and `experimentalTable` CSVs are fetched — never Raw Data.
Signed download URLs are never printed or stored (they carry credentials).
"""
from __future__ import annotations

import argparse
import json
import time
from datetime import datetime, timezone
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parents[1]
IDS_FILE = ROOT / "ingest" / "psi_ids.txt"
RAW_DIR = ROOT / "data" / "raw"

BASE = "https://psi.nasa.gov/geode-py/ws"
INVESTIGATION_URL = BASE + "/repo/investigations/{psi_id}"
DOWNLOAD_URL = BASE + "/studies/{psi_id}/download"

USER_AGENT = "TheIgniters-SpaceApps2026/1.0 (student hackathon)"
TIMEOUT = 30
DELAY_S = 1.0
RETRY_BACKOFF_S = (2, 5)  # up to 2 retries
ERROR_PAGE_PREFIXES = (b"<?xml", b"<!doctype", b"<html")


class FetchError(Exception):
    """A request failed; the message is safe to log (no signed URLs)."""


def read_ids(path: Path = IDS_FILE) -> list[str]:
    ids = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        ids.append(line.split()[0])
    return ids


def make_session() -> requests.Session:
    session = requests.Session()
    session.headers["User-Agent"] = USER_AGENT
    return session


def http_get(session: requests.Session, url: str, label: str, **kwargs) -> requests.Response:
    """Polite GET with retries on timeouts, connection errors and 5xx. `label` is what gets logged."""
    for attempt in range(len(RETRY_BACKOFF_S) + 1):
        if attempt:
            time.sleep(RETRY_BACKOFF_S[attempt - 1])
        time.sleep(DELAY_S)
        try:
            resp = session.get(url, timeout=TIMEOUT, **kwargs)
        except (requests.Timeout, requests.ConnectionError) as exc:
            problem = f"{label}: {type(exc).__name__}"
        else:
            if resp.status_code < 400:
                return resp
            problem = f"{label}: HTTP {resp.status_code}"
            if resp.status_code < 500:
                raise FetchError(problem)
        if attempt < len(RETRY_BACKOFF_S):
            print(f"    {problem} - retrying in {RETRY_BACKOFF_S[attempt]} s")
    raise FetchError(problem)


def is_error_page(body: bytes) -> bool:
    return body.lstrip().lower().startswith(ERROR_PAGE_PREFIXES)


def fetch_investigation(session: requests.Session, psi_id: str, force: bool) -> dict:
    path = RAW_DIR / f"{psi_id}.json"
    if path.exists() and not force:
        print(f"  {psi_id}.json cached")
        return json.loads(path.read_text(encoding="utf-8"))
    resp = http_get(session, INVESTIGATION_URL.format(psi_id=psi_id), f"{psi_id}.json")
    try:
        data = resp.json()
    except ValueError as exc:
        raise FetchError(f"{psi_id}.json: response is not JSON") from exc
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"  {psi_id}.json saved (HTTP {resp.status_code})")
    return data


def fetch_table(session: requests.Session, psi_id: str, entry: dict, force: bool) -> str:
    """Download one experimental-table CSV via the signed-URL endpoint. Returns the file name."""
    file_name = entry.get("file_name")
    if not file_name:
        raise FetchError(f"{psi_id}: experimentalTable entry has no file_name")
    file_name = Path(file_name).name  # never write outside data/raw/<id>/
    path = RAW_DIR / psi_id / file_name
    if path.exists() and not force:
        print(f"  {file_name} cached")
        return file_name

    params = {"file": entry["file_name"], "version": entry.get("version", 1), "redirect": "false"}
    resp = http_get(session, DOWNLOAD_URL.format(psi_id=psi_id), f"{file_name} (link)", params=params)
    signed_url = resp.text.strip().strip('"').strip()
    if not signed_url.startswith("http"):
        raise FetchError(f"{file_name}: download endpoint did not return a URL")

    body = http_get(session, signed_url, file_name).content
    if is_error_page(body):
        raise FetchError(f"{file_name}: got an XML/HTML error page instead of CSV")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(body)
    print(f"  {file_name} saved ({len(body)} bytes)")
    return file_name


def fetch_one(session: requests.Session, psi_id: str, force: bool) -> dict:
    print(f"{psi_id}")
    record = {"psi_id": psi_id, "acronym": None, "title": None, "doi": None,
              "json_ok": False, "tables": [], "errors": [],
              "fetched_at": datetime.now(timezone.utc).isoformat(timespec="seconds")}
    try:
        data = fetch_investigation(session, psi_id, force)
    except FetchError as exc:
        record["errors"].append(str(exc))
        print(f"  ERROR {exc}")
        return record
    record.update(json_ok=True, acronym=data.get("investigationAcronym"),
                  title=data.get("title"), doi=data.get("doi"))
    tables = data.get("experimentalTable") or []
    if not tables:
        print("  no experimental table")
    for entry in tables:
        try:
            record["tables"].append(fetch_table(session, psi_id, entry, force))
        except (FetchError, KeyError) as exc:
            record["errors"].append(str(exc))
            print(f"  ERROR {exc}")
    return record


def write_manifest(records: list[dict]) -> None:
    """Merge into the existing manifest so a partial run (--ids) doesn't drop other IDs."""
    path = RAW_DIR / "_manifest.json"
    merged: dict[str, dict] = {}
    if path.exists():
        merged = {r["psi_id"]: r for r in json.loads(path.read_text(encoding="utf-8"))}
    merged.update({r["psi_id"]: r for r in records})
    path.write_text(json.dumps(list(merged.values()), indent=2, ensure_ascii=False), encoding="utf-8")


def print_summary(records: list[dict]) -> None:
    ok = [r["psi_id"] for r in records if r["json_ok"] and not r["errors"]]
    failed = [r["psi_id"] for r in records if not r["json_ok"] or r["errors"]]
    with_tables = [r["psi_id"] for r in records if r["tables"]]
    without = [r["psi_id"] for r in records if r["json_ok"] and not r["tables"] and not r["errors"]]
    print("\n=== Summary ===")
    print(f"IDs OK: {len(ok)}   failed: {len(failed)} {failed or ''}")
    print(f"CSVs saved: {sum(len(r['tables']) for r in records)}")
    print(f"With tables ({len(with_tables)}): {', '.join(with_tables) or '-'}")
    print(f"Without tables ({len(without)}): {', '.join(without) or '-'}")
    for r in records:
        for err in r["errors"]:
            print(f"  {r['psi_id']}: {err}")


def main(argv: list[str] | None = None) -> list[dict]:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--ids", nargs="+", help="only these PSI IDs (default: ingest/psi_ids.txt)")
    parser.add_argument("--force", action="store_true", help="re-download even if cached")
    args = parser.parse_args(argv)

    RAW_DIR.mkdir(parents=True, exist_ok=True)
    session = make_session()
    records = [fetch_one(session, psi_id, args.force) for psi_id in (args.ids or read_ids())]
    write_manifest(records)
    print_summary(records)
    return records


if __name__ == "__main__":
    main()
