"""Flame in Freefall dashboard — minimal starting page.

Run from the repo root:  streamlit run app/main.py
Loads data/processed/investigations.json if it exists, otherwise the sample file.
"""
import json
from pathlib import Path

import streamlit as st

ROOT = Path(__file__).resolve().parents[1]
REAL = ROOT / "data" / "processed" / "investigations.json"
SAMPLE = ROOT / "data" / "processed" / "investigations.sample.json"


@st.cache_data
def load_investigations():
    path = REAL if REAL.exists() else SAMPLE
    with open(path, encoding="utf-8") as f:
        return json.load(f), path.name


st.set_page_config(page_title="Flame in Freefall", page_icon="🔥", layout="wide")
st.title("Flame in Freefall")
st.caption("Fire-safety insights from NASA microgravity combustion data (PSI Data Repository)")

records, source = load_investigations()
if source == SAMPLE.name:
    st.warning("Showing SAMPLE data. Real data appears once data/processed/investigations.json exists.")

st.write(f"{len(records)} investigations loaded from `{source}`")
for r in records:
    st.markdown(f"**{r['psi_id']} · {r['acronym']}** — {r['title']}  \nDOI: `{r['doi']}`")
