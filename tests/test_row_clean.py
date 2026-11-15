"""Row-level cleaning rules (extract/row_clean.py), checked on synthetic rows and the real snapshot."""
from extract.normalize import load_tables
from extract.row_clean import clean_table


def _table(psi_id):
    (_, headers, rows), *_ = load_tables(psi_id)
    return headers, rows


def test_footnotes_and_flow_vis_rows_are_not_tests():
    h, rows = _table("PSI-99")  # SAFFIRE-II: 9 samples + 2 flow-vis rows + 4 footnotes
    ct = clean_table("PSI-99", h, rows, "Material")
    assert [r.cells["Sample Number"] for r in ct.rows] == [f"2-{i}" for i in range(1, 10)]
    assert sum(e["reason"].startswith("footnote") for e in ct.excluded) == 4
    assert sum("flow-visualization" in e["reason"] for e in ct.excluded) == 2
    assert any(n.startswith("Note 1") for n in ct.notes)


def test_kept_cells_are_unchanged_and_typos_are_flagged_not_fixed():
    h, rows = _table("PSI-99")
    ct = clean_table("PSI-99", h, rows, "Material")
    row4 = next(r for r in ct.rows if r.cells["Sample Number"] == "2-4")
    assert row4.cells["Samle Thickness"] == "037 mm"
    assert any("typo for 0.37" in f for f in row4.flags)
    blank = next(r for r in ct.rows if r.cells["Sample Number"] == "2-6")
    assert any("blank in the source" in f for f in blank.flags)


def test_exact_duplicates_removed_with_pointer_to_first():
    h, rows = _table("PSI-107")  # SPICE: 469 rows, 34 exact duplicates (nasa102-159final.ipynb)
    ct = clean_table("PSI-107", h, rows)
    assert len(ct.rows) == 435
    assert all(e["reason"].startswith("exact duplicate of row") for e in ct.excluded)


def test_same_conditions_rows_have_no_measurements():
    h, rows = _table("PSI-102")  # SAME: only Teflon was measured
    ct = clean_table("PSI-102", h, rows)
    assert {r.cells["Sample Material"] for r in ct.rows} == {"Teflon"}
    assert len(ct.excluded) == 4


def test_fill_series_labels_corrected_only_in_label():
    h, rows = _table("PSI-21")
    ct = clean_table("PSI-21", h, rows, "Fuel Bottle")
    ch5 = next(r for r in ct.rows if r.cells["Fuel Bottle"] == "40% CH5")
    assert ch5.material_label == "40% CH4" and ch5.cells["Fuel Bottle"] == "40% CH5"
    assert any("fill-series" in f for f in ch5.flags)
    labels = {r.material_label or r.cells["Fuel Bottle"] for r in ct.rows}
    assert labels <= {"40% CH4", "100% CH4", "100% C2H4", "50% C2H4", "30% C2H4"}


def test_note_only_rows_dropped_and_notes_kept():
    h, rows = _table("PSI-22")
    ct = clean_table("PSI-22", h, rows, "Fuel Bottle")
    assert all(r.cells["Test Type"].strip() for r in ct.rows)
    assert any("YYDDD" in n for n in ct.notes)


def test_synthetic_rules():
    headers = ["Test", "Oxygen (%)", "Fuel", "Notes"]
    rows = [{"Test": "1", "Oxygen (%)": "3400%", "Fuel": "75 % Propylene", "Notes": "table note"},
            {"Test": "", "Oxygen (%)": "", "Fuel": "", "Notes": "only a note"},
            {"Test": "1", "Oxygen (%)": "3400%", "Fuel": "75 % Propylene", "Notes": "table note"}]
    ct = clean_table("PSI-X", headers, rows, "Fuel")
    assert len(ct.rows) == 1 and ct.rows[0].material_label == "75% Propylene"
    assert any("probably 34%" in f for f in ct.rows[0].flags)
    assert [e["reason"] for e in ct.excluded] == ["note / continuation row with no test identity", "exact duplicate of row 1"]
    assert "table note" in ct.notes and "only a note" in ct.notes
