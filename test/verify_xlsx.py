"""Reads the exported report and master list with openpyxl and prints a JSON summary (used by e2e.cjs)."""
import json
import sys

from openpyxl import load_workbook

report, master = sys.argv[1], sys.argv[2]
out = {}

wb = load_workbook(report, read_only=True)
out["sheets"] = wb.sheetnames

summary = wb[wb.sheetnames[0]]
rows = [list(r) for r in summary.iter_rows(values_only=True)]
total = next((r for r in rows if r and r[0] == "TOTAL"), None)
out["total"] = [str(x) for x in total[:7]] if total else []
out["summary_tables"] = sum(1 for r in rows if r and r[0] in ("Type", "Team"))

status = wb[wb.sheetnames[1]]
srows = [r for r in list(status.iter_rows(values_only=True))[1:] if r and r[0]]
out["status_rows"] = len(srows)
out["status_ids"] = [str(r[0]) for r in srows]
out["status_results"] = [r[3] for r in srows]

history = wb[wb.sheetnames[2]]
hrows = [r for r in list(history.iter_rows(values_only=True))[1:] if r and r[0]]
out["history_rows"] = len(hrows)
out["history_superseded"] = sum(1 for r in hrows if r[8] == "Yes")
out["history_ids"] = [str(r[2]) for r in hrows]

mb = load_workbook(master, read_only=True)
ms = mb[mb.sheetnames[0]]
mrows = [r for r in list(ms.iter_rows(values_only=True))[1:] if r and r[0]]
out["master_sheet"] = mb.sheetnames[0]
out["master_rows"] = len(mrows)
out["master_ids"] = [str(r[0]) for r in mrows]
out["master_types"] = [str(r[1]) for r in mrows]

print(json.dumps(out))
