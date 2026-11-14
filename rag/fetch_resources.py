"""Fetch the text resources in rag/sources.json once -> data/raw/resources/<id>.txt.

Usage:
    python -m rag.fetch_resources            # skip files already saved
    python -m rag.fetch_resources --force    # re-fetch

File format: "Title: ...", "URL: ...", blank line, cleaned main text.
Polite like ingest/fetch_psi.py (same session helper): sequential, 1 s between requests, retries.
A page that can't be fetched or looks wrong is reported with its URL — save it by hand from a
browser into the same file (same header lines), never skip it.
"""
from __future__ import annotations

import argparse
import io
import json
import re
import time

from bs4 import BeautifulSoup

from ingest.fetch_psi import FetchError, http_get, make_session
from rag import config

DROP_TAGS = ("script", "style", "noscript", "nav", "header", "footer", "aside", "iframe", "svg", "button")
DROP_HINTS = re.compile(r"cookie|banner|breadcrumb|menu|share|social|newsletter|skip-link|related|sidebar", re.I)
BLOCKS = ("h1", "h2", "h3", "h4", "p", "li", "blockquote", "figcaption", "td")
INITIALIZING = "initializing"


def text_sources() -> list[dict]:
    return [s for s in json.loads(config.SOURCES_FILE.read_text(encoding="utf-8")) if s["type"] == "text"]


def clean_lines(text: str) -> str:
    """Collapse spaces inside lines and runs of blank lines; keep paragraph breaks."""
    lines = [re.sub(r"[ \t ]+", " ", line).strip() for line in text.splitlines()]
    return re.sub(r"\n{3,}", "\n\n", "\n".join(lines)).strip()


def html_to_text(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(DROP_TAGS):
        tag.decompose()
    for tag in soup.find_all(attrs={"class": DROP_HINTS}) + soup.find_all(attrs={"id": DROP_HINTS}):
        if tag.name not in ("body", "main", "article") and not tag.decomposed:
            tag.decompose()
    root = soup.find("article") or soup.find("main")
    if root is None:  # largest text block
        candidates = soup.find_all(["div", "section"]) or [soup]
        root = max(candidates, key=lambda t: len(t.get_text(" ", strip=True)))
    blocks = []
    for el in root.find_all(BLOCKS):
        if el.find_parent(BLOCKS):  # nested (e.g. <p> inside <li>) - parent already has it
            continue
        text = el.get_text(" ", strip=True)
        if text and text not in blocks[-1:]:
            blocks.append(text)
    return clean_lines("\n\n".join(blocks) if blocks else root.get_text("\n"))


def pdf_to_text(data: bytes) -> str:
    from pypdf import PdfReader

    pages = [page.extract_text() or "" for page in PdfReader(io.BytesIO(data)).pages]
    return clean_lines("\n\n".join(pages))


def fetch_text(session, source: dict) -> str:
    if source.get("pdf_url"):
        return pdf_to_text(http_get(session, source["pdf_url"], f"{source['id']} (pdf)").content)
    resp = http_get(session, source["url"], source["id"])
    if INITIALIZING in resp.text.lower() and "sma.nasa.gov" in source["url"]:
        print(f"  {source['id']}: 'System is initializing' page - waiting 5 s and retrying once")
        time.sleep(5)
        resp = http_get(session, source["url"], source["id"])
    resp.encoding = resp.encoding if resp.encoding and resp.encoding.lower() != "iso-8859-1" else "utf-8"
    return html_to_text(resp.text)


def check(text: str, min_words: int = config.MIN_RESOURCE_WORDS) -> str | None:
    """Problem with a saved text, or None if it looks like a real article."""
    words = len(text.split())
    if words < min_words:
        return f"only {words} words"
    if INITIALIZING in text.lower():
        return "contains 'initializing' (placeholder page)"
    return None


def body_of(path) -> str:
    return path.read_text(encoding="utf-8").split("\n\n", 1)[-1]


def main(argv: list[str] | None = None) -> list[dict]:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--force", action="store_true", help="re-fetch even if saved")
    args = parser.parse_args(argv)

    config.RESOURCES_DIR.mkdir(parents=True, exist_ok=True)
    session = make_session()
    rows = []
    for source in text_sources():
        path = config.RESOURCES_DIR / f"{source['id']}.txt"
        status = "cached"
        if args.force or not path.exists():
            try:
                text = fetch_text(session, source)
                path.write_text(f"Title: {source['title']}\nURL: {source['url']}\n\n{text}\n", encoding="utf-8")
                status = "fetched"
            except FetchError as exc:
                rows.append({"id": source["id"], "words": 0, "ok": False, "problem": str(exc), "url": source["url"]})
                continue
        # A few legacy Spinoff articles are genuinely short; sources.json records that per source.
        problem = check(body_of(path), source.get("min_words", config.MIN_RESOURCE_WORDS))
        rows.append({"id": source["id"], "words": len(body_of(path).split()), "ok": problem is None,
                     "problem": problem or status, "url": source.get("pdf_url") or source["url"]})

    print("\n| id | words | status |\n|---|---|---|")
    for r in rows:
        print(f"| {r['id']} | {r['words']} | {'ok' if r['ok'] else 'FAILED'} ({r['problem']}) |")
    failed = [r for r in rows if not r["ok"]]
    if failed:
        print("\nSave these by hand from a browser into data/raw/resources/<id>.txt "
              "(keep the 'Title:' / 'URL:' header lines):")
        for r in failed:
            print(f"  {r['id']}: {r['url']}")
    return rows


if __name__ == "__main__":
    main()
