"""
Extracts employee / establishment data from the UoK source files into data/seed.json.

Sources (project root):
  - List of Teachers 12-10-2026.xlsx         -> faculty members (teaching staff) incl. administrative charges
  - Vacant Positions BPS-1  to BPS-16.pdf    -> non-teaching vacancy statement (BPS 1-16)
Sources (new/):
  - New Final 2026 List.xlsx                 -> units (departments & offices), budgeted posts, non-teaching staff
                                                (supersedes Updated Budget.xlsx)
  - 1-16.pdf                                 -> non-teaching staff B-01..B-16 with official PIN numbers
  - 17 & above.pdf                           -> non-teaching officers BPS-17+ (current designation / scale / office)
  - bps-17.pdf                               -> working, budgeted & vacant positions BPS-17+ with remarks
  - Teaching Data.pdf                        -> department-wise teaching positions (sanctioned / working / vacant)
  - budget perofrma complete filled.xlsx     -> post-wise establishment (approved posts 2006-10 / after 2010 / abolished)
  - Recruitment-Rules-APPROVED.docx          -> Recruitment Rules 2026 for BPS-17+ posts (Syndicate 21-01-2026)
  - DRG.pdf, JD'S OF DRG STAFF.pdf           -> sections of the DRG office, job descriptions & staff assignments

Usage:  python scripts/extract_data.py
"""
import datetime as dt
import difflib
import json
import re
from collections import Counter, defaultdict
from pathlib import Path

import docx
import openpyxl
import pdfplumber

ROOT = Path(__file__).resolve().parent.parent
NEW = ROOT / "new"
OUT = ROOT / "data" / "seed.json"


def clean(v):
    if v is None:
        return None
    if isinstance(v, str):
        v = re.sub(r"\s+", " ", v.replace("�", "'")).strip()
        return v or None
    return v


def to_date(v):
    if isinstance(v, dt.datetime):
        return v.date().isoformat()
    if isinstance(v, dt.date):
        return v.isoformat()
    if isinstance(v, str):
        for fmt in ("%d-%b-%Y", "%d-%m-%Y", "%d/%m/%Y", "%d.%m.%Y"):
            try:
                return dt.datetime.strptime(v.strip(), fmt).date().isoformat()
            except ValueError:
                pass
    return None


def to_int(v):
    if v is None:
        return None
    m = re.search(r"\d+", str(v))
    return int(m.group()) if m else None


def classify_unit(name):
    n = name.upper()
    if n.startswith("DEAN"):
        return "Faculty / Dean Office"
    if n.startswith("DEPARTMENT") or n.startswith("SCHOOL"):
        return "Teaching Department"
    if n.startswith("INSTITUTE"):
        return "Institute"
    if "CENTRE" in n or "CENTER" in n or "CHAIR" in n or "HERBARIUM" in n:
        return "Research Centre"
    if n.startswith("DIRECTORATE"):
        return "Directorate"
    return "Administrative Office"


def title_case(s):
    small = {"of", "and", "&", "for", "the", "in"}
    words = s.lower().split()
    out = []
    for i, w in enumerate(words):
        if i and w in small:
            out.append(w)
        elif re.fullmatch(r"\(?[a-z]{1,4}\)?", w) and w.strip("()") in {"ubit", "kuh", "rfc", "lan", "asrb", "mphil."}:
            out.append(w.upper())
        else:
            out.append(w[:1].upper() + w[1:])
    return " ".join(out)


ACRONYMS = {"IT", "PA", "PS", "AV", "LAN", "II", "III", "IV", "QEC", "ACP", "CCT", "UDC", "LDC", "DDO", "NTN", "VC", "PVC"}


def nice_designation(d):
    """'JNR.ACCOUNTANT' -> 'Jnr. Accountant', 'U. D. C.' -> 'U.D.C.', 'SUB - ENGINEER' -> 'Sub-Engineer'"""
    if not d:
        return d
    d = re.sub(r"\s*-\s*", "-", d)
    d = re.sub(r"\.(?=[A-Za-z]{2})", ". ", d)
    d = re.sub(r"(?<=\b[A-Za-z]\.)\s+(?=[A-Za-z]\.)", "", d)
    d = re.sub(r"(?<=\b[A-Za-z]\.)\s+(?=[A-Za-z]\.)", "", d)

    def word(w):
        if re.fullmatch(r"(?:[A-Za-z]\.){2,}", w) or w.strip("().").upper() in ACRONYMS:
            return w.upper()
        return "-".join(p[:1].upper() + p[1:].lower() for p in w.split("-"))

    return " ".join(word(w) for w in d.split())


def guess_gender(name):
    n = (name or "").lower()
    if re.match(r"^(mrs|ms|miss)\b", n) or re.search(r"\b(begum|bano|khatoon|bibi)\b", n):
        return "Female"
    if re.match(r"^mr\b", n) or re.search(r"\b(muhammad|mohammad|ahmed|ahmad|s/o)\b", n):
        return "Male"
    return None


# ---------------------------------------------------------------- budget book
def parse_budget():
    # read_only + max_col: the sheet's used range is declared as 16k columns wide
    wb = openpyxl.load_workbook(NEW / "New Final 2026 List.xlsx", data_only=True, read_only=True)
    units, posts, staff = [], [], []
    for ws in wb.worksheets:
        rows = [tuple(clean(c) for c in r) for r in ws.iter_rows(values_only=True, max_col=12)]
        unit = None
        mode = None
        section = None
        col = {}
        for i, r in enumerate(rows):
            a = r[0]
            nxt = rows[i + 1][0] if i + 1 < len(rows) else None
            if isinstance(a, str) and isinstance(nxt, str) and nxt.startswith("S.No:"):
                code = to_int(nxt)
                unit = {
                    "code": f"{code:03d}",
                    "name": title_case(a),
                    "source_name": a,
                    "sheet": ws.title,
                    "category": classify_unit(a),
                }
                units.append(unit)
                mode, section = None, None
                continue
            if unit is None:
                continue
            if a == "S.No" and r[1] in ("Working Designation", "Name"):
                # column positions differ between budget-book editions; read them from the header row
                col = {h: j for j, h in enumerate(r) if isinstance(h, str)}
                mode = "budget" if r[1] == "Working Designation" else "staff"
                continue
            if isinstance(a, str) and a.startswith("Section"):
                section = a.replace("Section", "").strip(" '\"“”‘’")
                continue
            if not isinstance(a, (int, float)) or not isinstance(r[1], str):
                continue
            if mode == "budget":
                posts.append({
                    "unit_code": unit["code"],
                    "section": section,
                    "designation": r[1],
                    "bps": to_int(r[col["BPS"]]),
                    "positions": to_int(r[col["Budgeted Position"]]) or 0,
                })
            elif mode == "staff":
                d = col["Designation"]
                staff.append({
                    "unit_code": unit["code"],
                    "name": r[1].upper(),
                    "bps": to_int(r[col["BPS"]]),
                    "designation": r[d],
                    "posting_label": r[d + 1],  # unlabelled column right of the designation
                    "date_of_retirement": to_date(r[col["Date of Retirement"]]),
                })
    return units, posts, staff


# ---------------------------------------------------------------- faculty list
def parse_teachers():
    wb = openpyxl.load_workbook(ROOT / "List of Teachers 12-10-2026.xlsx", data_only=True)
    ws = wb["Sheet1"]
    out = []
    for r in ws.iter_rows(min_row=5, values_only=True):
        raw = list(r)
        r = [clean(c) for c in raw]
        if not r[2]:
            continue
        status_raw = r[1] or "Working"
        charges = []
        if r[7]:
            charges.append({
                "role": r[7].strip("() "),
                "unit": r[4],
                "present_from": to_date(raw[8]), "present_to": clean(str(raw[9])) if raw[9] and not to_date(raw[9]) else to_date(raw[9]),
                "second_term": pair_terms(raw[10], raw[11]),
                "first_from": to_date(raw[12]), "first_to": to_date(raw[13]),
            })
        if r[15]:
            charges.append({
                "role": r[16] or "Additional Charge",
                "unit": r[15],
                "present_from": to_date(raw[17]),
                "present_to": to_date(raw[18]) or clean(str(raw[18])) if raw[18] else None,
                "second_term": None, "first_from": None, "first_to": None,
            })
        out.append({
            "name": r[2],
            "status_raw": status_raw,
            "designation": r[3],
            "department": r[4],
            "date_of_birth": to_date(raw[5]),
            "date_of_retirement": to_date(raw[6]),
            "director_id": r[14],
            "charges": charges,
        })
    return out


def pair_terms(frm, to):
    """Cells may stack several terms on separate lines: pair the i-th 'from' with the i-th 'to'."""
    split = lambda v: [x.strip() for x in str(v).splitlines() if x.strip()] if v else []
    fmt = lambda v: to_date(v) and dt.date.fromisoformat(to_date(v)).strftime("%d %b %Y") or (v.isoformat()[:10] if hasattr(v, "isoformat") else v)
    f, t = split(frm) if not hasattr(frm, "isoformat") else [frm], split(to) if not hasattr(to, "isoformat") else [to]
    pairs = [f"{fmt(f[i]) if i < len(f) else '?'} to {fmt(t[i]) if i < len(t) else '?'}" for i in range(max(len(f), len(t)))]
    return "; ".join(pairs) or None


def map_status(s):
    s = (s or "").upper()
    if "SUSPEND" in s:
        return "Suspended"
    if "LIEN" in s:
        return "On Lien"
    if "F.S.L" in s:
        return "Foreign Study Leave"
    if "S/L" in s:
        return "Study Leave"
    if "UA" in s or "U/A" in s:
        return "Unauthorized Absence"
    return "Working"


# ---------------------------------------------------------------- vacancies
def pdf_rows(path):
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            for table in page.extract_tables():
                for row in table:
                    yield [clean(c) for c in row]


def to_signed(v):
    m = re.search(r"-?\d+", str(v or ""))
    return int(m.group()) if m else 0


def parse_vacancies():
    out = []
    for row in pdf_rows(ROOT / "Vacant Positions BPS-1  to BPS-16.pdf"):
        if not row or not row[0] or not str(row[0]).isdigit():
            continue
        _, post, bps, sanc, work, vac, prio = (row + [None] * 7)[:7]
        out.append({
            "group": "BPS 1-16", "post": post, "department": None, "bps": bps,
            "sanctioned": to_int(sanc) or 0, "working": to_int(work) or 0,
            "vacant": to_int(vac) or 0, "priority": to_int(prio), "remarks": None,
        })
    # Working / budgeted / vacant statement BPS-17+ (supersedes "Vacant Positions BPS-17 & above.pdf",
    # which listed vacant lines only)
    for row in pdf_rows(NEW / "bps-17.pdf"):
        if not row or not row[0] or not str(row[0]).isdigit():
            continue
        _, post, dept, bps, sanc, work, vac, remarks = (row + [None] * 8)[:8]
        out.append({
            "group": "BPS 17 & above", "post": post, "department": dept, "bps": bps,
            "sanctioned": to_int(sanc) or 0, "working": to_int(work) or 0,
            "vacant": to_int(vac) or 0, "priority": None,
            "remarks": None if remarks in (None, "-") else remarks,
        })
    # Teaching positions: the department name is only on the first row of each block
    dept = None
    for row in pdf_rows(NEW / "Teaching Data.pdf"):
        row = (row + [None] * 8)[:8]
        if row[1] not in TEACHING_BPS:
            continue
        if row[2]:
            dept = row[2]
        out.append({
            "group": "Teaching", "post": row[1], "department": dept, "bps": row[3],
            "sanctioned": to_int(row[4]) or 0, "working": to_int(row[5]) or 0,
            # negative = more incumbents than sanctioned posts (kept so totals match the statement)
            "vacant": to_signed(row[6]), "priority": to_int(row[7]), "remarks": None,
        })
    return out


TEACHING_BPS = {"Professor": 21, "Associate Professor": 20, "Assistant Professor": 19, "Lecturer": 18}


# ---------------------------------------------------------------- official staff lists
def parse_pin_list():
    """1-16.pdf: S.#, PIN #, NAME, GRADE, DESIGNATION, DEPARTMENT"""
    return [
        {"pin": r[1], "name": r[2], "bps": to_int(r[3]), "designation": r[4], "department": r[5]}
        for r in pdf_rows(NEW / "1-16.pdf")
        if len(r) >= 6 and r[0] and r[0].isdigit()
    ]


def parse_officers():
    """17 & above.pdf: Sr.#, Name, Scale, Designation, Department (numbering restarts per scale)"""
    return [
        {"name": r[1], "bps": to_int(r[2]), "designation": r[3], "department": r[4]}
        for r in pdf_rows(NEW / "17 & above.pdf")
        if len(r) >= 5 and r[0] and r[0].isdigit()
    ]


def name_key(n):
    """Comparable name: drop titles and the common 'Syed' / 'Muhammad' / initials that lists use inconsistently."""
    n = (n or "").upper()
    n = re.sub(r"\b(DR|MR|MRS|MS|MISS|PROF|ENGR|HAFIZ|SYED|SYEDA|MUHAMMAD|MUHAMMMAD|MOHAMMAD|MUHAMMED|M|S|K)\b\.?", " ", n)
    return re.sub(r"[^A-Z]", "", n)


def match_people(people, staff, used, bps_slack, same_office):
    """Match list entries to budget-book staff rows one-to-one. Returns {people index: staff index}.
    same_office: spelling-variant matches must also agree on the office (the B-01..B-16 list uses the same
    office labels as the budget book; the officers list names the actual posting, which often differs)."""
    by_key = defaultdict(list)
    for i, s in enumerate(staff):
        by_key[name_key(s["name"])].append(i)
    keys = list(by_key)
    res = {}

    def similarity(i, p):
        return difflib.SequenceMatcher(None, f"{staff[i]['posting_label'] or ''} {staff[i]['designation'] or ''}".upper(),
                                       f"{p['department']} {p['designation']}".upper()).ratio()

    def office_ok(i, p):
        return not same_office or difflib.SequenceMatcher(
            None, (staff[i]["posting_label"] or "").upper(), (p["department"] or "").upper()).ratio() >= 0.6

    # pass 1: exact name key; ties broken by same BPS, then office / designation similarity
    for j, p in enumerate(people):
        cand = [i for i in by_key.get(name_key(p["name"]), []) if i not in used]
        if len(cand) > 1:
            cand = [i for i in cand if staff[i]["bps"] == p["bps"]] or cand
            cand.sort(key=lambda i: -similarity(i, p))
        if cand:
            res[j] = cand[0]
            used.add(cand[0])
    # pass 2: close spelling ("Barki" / "Burki") or one name extending the other ("Farman Rasool Rizvi"), similar BPS
    for j, p in enumerate(people):
        if j in res:
            continue
        k = name_key(p["name"])
        close = difflib.get_close_matches(k, keys, n=3, cutoff=0.85)
        close += [x for x in keys if len(k) >= 8 and len(x) >= 8 and (x.startswith(k) or k.startswith(x)) and x not in close]
        for x in close:
            cand = [i for i in by_key[x] if i not in used and staff[i]["bps"] is not None and p["bps"] is not None
                    and abs(staff[i]["bps"] - p["bps"]) <= bps_slack and office_ok(i, p)]
            if cand:
                cand.sort(key=lambda i: -similarity(i, p))
                res[j] = cand[0]
                used.add(cand[0])
                break
    # pass 3: abbreviated forenames ("K. Muhammad Masoom Ghori", "Adnan A. Barki") — full-name similarity with
    # the same BPS, same initial and a similar surname; only when exactly one candidate qualifies
    def words(n):
        return re.sub(r"[^A-Z ]", " ", n.upper()).split()
    for j, p in enumerate(people):
        if j in res:
            continue
        pw = words(p["name"])
        cand = [i for i, s in enumerate(staff) if i not in used and s["bps"] == p["bps"] and (w := words(s["name"]))
                and w[0][0] == pw[0][0]
                and difflib.SequenceMatcher(None, w[-1], pw[-1]).ratio() >= 0.75
                and difflib.SequenceMatcher(None, " ".join(w), " ".join(pw)).ratio() >= 0.75 and office_ok(i, p)]
        if len(cand) == 1:
            res[j] = cand[0]
            used.add(cand[0])
    return res


# ---------------------------------------------------------------- establishment (post-wise)
def parse_establishment():
    wb = openpyxl.load_workbook(NEW / "budget perofrma complete filled.xlsx", data_only=True)
    out = []
    for r in wb["Sheet1"].iter_rows(min_row=5, values_only=True):
        r = [clean(c) for c in r]
        if not isinstance(r[1], str):
            # unnamed continuation line under "Computer Operator" (71 more approved posts); the sheet's
            # grand total includes it. The final row is the grand total itself.
            if out and r[0] is None and r[2] and r[5]:
                out[-1]["approved_2006_10"] += to_int(r[2]) or 0
                out[-1]["total"] += to_int(r[6]) or 0
            continue
        out.append({
            "post": r[1],
            "bps": to_int(r[5]),
            "approved_2006_10": to_int(r[2]) or 0,
            "approved_after_2010": to_int(r[3]) or 0,
            "abolished": to_int(r[4]) or 0,
            "total": to_int(r[6]) or 0,
            "working": to_int(r[7]),
            "remarks": "Not approved yet" if "not approved" in r[1].lower() else None,
        })
    for e in out:
        e["post"] = re.sub(r"\s*\(Not approved yet\)", "", e["post"])
    return out


# ---------------------------------------------------------------- recruitment rules
RR_FIELDS = [  # (row label prefix, key)
    ("name of the post", "post_title"), ("number of posts", "num_posts"), ("cadre", "cadre"),
    ("classification", "classification"), ("sanctioned scale", "scale"), ("recruitment mode", "recruitment_mode"),
    ("maximum age", "age_limit"), ("minimum educ", "qualification"), ("period of probation", "probation"),
    ("probation", "probation"), ("experience", "experience"), ("job description", "job_description"),
]


def cell_text(c):
    return "\n".join(p.text.strip() for p in c.paragraphs if p.text.strip())


def parse_recruitment_rules():
    doc = docx.Document(NEW / "Recruitment-Rules-APPROVED.docx")
    paras = doc.paragraphs
    annex = next(i for i, p in enumerate(paras) if p.text.strip().startswith("Annexure"))
    general = []
    for p in paras[:annex]:
        t = re.sub(r"\s+", " ", p.text).strip()
        if t:
            heading = p.style.name.startswith("Heading") or bool(re.fullmatch(r"(\d+\.\s.*|[A-Z][A-Z &,]+:?|Preliminaries and Title)", t))
            general.append({"text": t, "heading": heading and len(t) < 80})

    # Annexure-I schedule: sanctioned posts per department
    # (numbered differently from Annexure-II, so rules are linked to it by post name)
    schedule = []
    for row in doc.tables[0].rows[1:]:
        c = [cell_text(x) for x in row.cells]
        depts, posts = c[2].split("\n"), c[4].split("\n")
        schedule.append({"post": c[1].replace("\n", " / "), "scale": c[3].replace("\n", " / "),
                         "departments": [{"department": d.strip(), "posts": posts[i].strip() if i < len(posts) else None}
                                         for i, d in enumerate(depts) if d.strip()]})

    def post_norm(s, strip_parens=False):
        s = s.lower().replace("sr.", "senior").replace("broad cast", "broadcast")
        if strip_parens:
            s = re.sub(r"\(.*?\)", "", s)
        return re.sub(r"[^a-z]", "", s)

    def schedule_score(rule_post, row):
        """(best score, best score keeping qualifiers) — qualifiers like '(IT)' break ties between rows"""
        keep = max(difflib.SequenceMatcher(None, post_norm(rule_post), post_norm(p)).ratio() for p in row["post"].split(" / "))
        loose = max(difflib.SequenceMatcher(None, post_norm(rule_post, True), post_norm(p, True)).ratio() for p in row["post"].split(" / "))
        return max(keep, loose), keep

    # Annexure-II: one 10-row table per post, in the order of the "Sr. No. N: <post>" paragraphs
    labels = [re.sub(r"\s+", " ", p.text).strip() for p in paras[annex:] if p.text.strip().startswith("Sr. No.")]
    rules = []
    for label, table in zip(labels, doc.tables[1:]):
        m = re.match(r"Sr\. No\. (\d+)(?:-([a-z]))?:\s*(.*)", label)
        rule = {"sr_no": int(m.group(1)), "sr_label": m.group(1) + (f"-{m.group(2)}" if m.group(2) else ""), "post": m.group(3).strip()}
        for row in table.rows:
            cells = row.cells
            lab = re.sub(r"\s+", " ", cells[1].text).strip().lower()
            val = cell_text(cells[2]).strip()
            key = next((k for prefix, k in RR_FIELDS if lab.startswith(prefix)), None)
            if key and val and key not in rule:
                rule[key] = val
        rule["post_title"] = re.sub(r"\s*\n\s*", " / ", rule.get("post_title", rule["post"]))
        best = max(schedule, key=lambda s: schedule_score(rule["post"], s))
        depts = best["departments"] if schedule_score(rule["post"], best)[0] >= 0.85 else []
        # "Director (Physical Education)", "Deputy Registrar (Legal)": keep only the department(s) the qualifier names
        qual = re.search(r"\((.+)\)", rule["post_title"]) or re.search(r"\((.+)\)", rule["post"])
        if qual and len(depts) > 1:
            names = [q.strip().lower() for q in qual.group(1).split("/")]
            only = [d for d in depts if any(n in d["department"].lower()
                                            or difflib.SequenceMatcher(None, n, d["department"].lower()).ratio() >= 0.6 for n in names)]
            depts = only or depts
        rule["departments"] = depts
        rules.append(rule)
    return {"general": general, "rules": rules}


# ---------------------------------------------------------------- DRG office
def parse_drg_office():
    text = "\n".join(p.extract_text() or "" for p in pdfplumber.open(NEW / "DRG.pdf").pages)
    sections = []
    for m in re.finditer(r"^(\d+)\.\s*(.+?)\s*:?-?\s*\n(.*?)(?=^\d+\.\s|\Z)", text, re.S | re.M):
        name = re.sub(r"\s*\(.*?\)\s*$", "", m.group(2)).strip(" :-")
        sections.append({"sort": int(m.group(1)), "name": name, "description": re.sub(r"\s+", " ", m.group(3)).strip()})

    pdf = pdfplumber.open(NEW / "JD'S OF DRG STAFF.pdf")
    jds, staff = [], []
    for pno, page in enumerate(pdf.pages):
        t = page.extract_text() or ""
        if not t.strip():
            continue
        lines = [l.strip() for l in t.splitlines() if l.strip()]
        head = re.search(r"GENERAL JOB DESCRIPTIONS FOR THE POSITION OF\s+(.+)", t)
        if head:
            position = head.group(1).strip().title().replace("C.C.T", "C.C.T.").replace("U.D.C.", "U.D.C.").replace("..", ".")
            body = t[head.end():]
            intro = body.split("\n1.")[0].strip() if "\n1." in body else ""
            duties_txt = body[len(intro):].split("At present")[0]
        else:
            # personal JDs (Deputy Registrar, Assistant Registrar)
            name = re.search(r"Name\s*:\s*(.+)", t).group(1).strip()
            desig = re.search(r"Designation\s*:\s*(.+?)\n(?=[A-Z ]+:)", t, re.S).group(1)
            position = re.sub(r"\s+", " ", desig).strip()
            sec = re.search(r"(JOB PURPOSE|SUMMARY):\s*(.+?)\n(KEY RESPONSIBILITIES|JOB DESCRIPTION)", t, re.S)
            intro = re.sub(r"\s+", " ", sec.group(2)).strip()
            duties_txt = t[sec.end():]
            staff.append({"name": name, "designation": position, "section": "Office of the Deputy Registrar (General)",
                          "duties": None, "jd": len(jds), "sort": pno})
        # numbered "1. …" or bulleted " …" duties, wrapped over several lines
        items = re.split(r"\n\s*(?:\d+\.|)\s*", "\n" + duties_txt)
        duties = [re.sub(r"\s+", " ", x).strip() for x in items if x.strip(" :-\n")]
        jd_title = re.sub(r".*performing duties as\s+", "", position)  # "P.A. to PVC … as Assistant Registrar"
        jds.append({"position": jd_title, "summary": re.sub(r"\s+", " ", intro).strip() or None, "duties": duties})

        if head:
            for tbl in page.extract_tables():
                for r in tbl:
                    r = [clean(c) for c in r]
                    if len(r) == 4 and r[0] and r[0].isdigit():
                        staff.append({"name": r[1], "designation": position, "section": r[2], "duties": r[3],
                                      "jd": len(jds) - 1, "sort": pno})
                    elif len(r) == 2 and r[0] and r[1] and r[0] != "Sr.":
                        staff.append({"name": r[0], "designation": r[1], "section": None, "duties": None,
                                      "jd": len(jds) - 1, "sort": pno})
    # "Hostel Keeper (performing duties as CCT.)" sits in the Section column
    for s in staff:
        if s["section"] and "performing duties" in s["section"]:
            s["designation"], s["section"] = s["section"], "Service Book / Pension Section"
    # the JD tables name sections differently from DRG.pdf; file staff under the DRG.pdf section names
    for sec in sections:
        sec["name"] = sec["name"].replace("N.T.1", "N.T.I")
    aliases = {"N.T. (Technical) Section": "Non-teaching (Technical) Section", "N.T. (Officers) Section": "Non-Teaching (Officers) Section",
               "Service Book / Pension Section": "Non-Teaching (S-Book) Section", "NOC & Medical Book Section": "Medical Book Section"}
    names = {sec["name"] for sec in sections}
    for s in staff:
        s["section"] = aliases.get(s["section"], s["section"])
        assert s["section"] is None or s["section"] in names or s["section"].startswith("Office of"), s["section"]
    return {"sections": sections, "job_descriptions": jds, "staff": staff}


def norm(s):
    s = (s or "").lower()
    s = re.sub(r"^(department|institute|centre|center|dean,?|school) (of|for)?\s*", "", s)
    s = s.replace("&", "and").replace("agribus.", "agribusiness").replace("phy.", "physical").replace("chem.", "chemical")
    return re.sub(r"[^a-z ]", "", s).strip()


def main():
    units, posts, staff = parse_budget()
    teachers = parse_teachers()
    vacancies = parse_vacancies()

    # map teacher departments onto budget units; create teaching units that do not exist in budget book
    by_norm = {norm(u["source_name"]): u for u in units}
    next_code = 900
    dept_map = {}
    aliases = {
        "National Nematological Research Centre": "NATIONAL NEMATOLOGICAL CENTRE",
        "QEC": "QUALITY ENHANCEMENT CELL",
        "BCC&T": "BUREAU OF COMPOSITION, COMPILATION & TRANCELATION",
        "Registrar": "REGISTRAR OFFICE",
        "Evening Program": "DIRECTORATE OF EVENING PROGRAM",
        "Controller of Examinations": "EXAMINATION OFFICE",
        "Student Guidance, Placement and Overseas Examination Bureau": "STUDENTS GUIDANCE COUNSELLING & PLACEMENT BUREAU",
        "Dr. Muhammad Ajmal Khan Institute of Sustainable Halophyte Utilization": "INSTITUTE OF SUSTAINABLE HALOPHYTE",
        "Dr. Zafar H. Zaidi National Centre for Proteomics": "NATIONAL CENTRE FOR PROTEOMICS",
        "Inst. of Envirnmental Studies": "INSTITUTE OF ENVIRONMENTAL STUDIES",
    }
    for dname in sorted({t["department"] for t in teachers if t["department"]}):
        key = norm(aliases.get(dname, dname))
        match = by_norm.get(key)
        if not match:
            cand = difflib.get_close_matches(key, list(by_norm), n=1, cutoff=0.82)
            match = by_norm[cand[0]] if cand else None
        if not match:
            next_code += 1
            match = {"code": f"{next_code}", "name": dname, "source_name": dname,
                     "sheet": "Faculty List", "category": "Teaching Department"}
            units.append(match)
            by_norm[key] = match
        dept_map[dname] = match["code"]

    def match_unit(name):
        key = norm(aliases.get(name, name))
        if key in by_norm:
            return by_norm[key]["code"]
        cand = difflib.get_close_matches(key, list(by_norm), n=1, cutoff=0.75)
        return by_norm[cand[0]]["code"] if cand else None

    for t in teachers:
        for i, c in enumerate(t["charges"]):
            # first charge is headship of own department; additional charges name another unit
            c["unit_code"] = dept_map.get(t["department"]) if i == 0 and c["unit"] == t["department"] else match_unit(c["unit"] or "")

    employees = []
    for i, t in enumerate(teachers, 1):
        employees.append({
            "employee_no": f"UOK-T-{i:04d}",
            "full_name": t["name"],
            "gender": guess_gender(t["name"]),
            "staff_type": "Teaching",
            "designation": t["designation"],
            "bps": {"Professor": 21, "Associate Professor": 20, "Assistant Professor": 19, "Lecturer": 18}.get(t["designation"]),
            "unit_code": dept_map.get(t["department"]),
            "status": map_status(t["status_raw"]),
            "status_remarks": t["status_raw"] if t["status_raw"] != "Working" else None,
            "date_of_birth": t["date_of_birth"],
            "date_of_retirement": t["date_of_retirement"],
            "director_id": t["director_id"],
            "charges": t["charges"],
            "source": "List of Teachers 12-10-2026.xlsx",
        })
    # official lists: officers first (smaller, BPS-17+), then the PIN list (B-01..B-16)
    pins, officers = parse_pin_list(), parse_officers()
    used = set()
    off_match = match_people(officers, staff, used, bps_slack=2, same_office=False)
    pin_match = match_people(pins, staff, used, bps_slack=1, same_office=True)
    pin_of = {i: pins[j] for j, i in pin_match.items()}
    off_of = {i: officers[j] for j, i in off_match.items()}
    pin_count = Counter(p["pin"] for p in pins)

    # office labels used by the lists -> budget units, learned from the matched people (majority vote)
    votes = defaultdict(Counter)
    for i, p in list(pin_of.items()) + list(off_of.items()):
        votes[p["department"]][staff[i]["unit_code"]] += 1

    list_aliases = {"Computerized Accounting Section": "Comp. Acc. Sec.", "N.N.R.C": "NATIONAL NEMATOLOGICAL CENTRE"}

    def list_unit(label):
        label = list_aliases.get(label, label)
        if votes.get(label):
            code, n = votes[label].most_common(1)[0]
            if n * 2 >= sum(votes[label].values()):
                return code
        return match_unit(label)

    def derived_dob(retire):
        if not retire:
            return None
        d = dt.date.fromisoformat(retire) + dt.timedelta(days=1)
        try:
            return d.replace(year=d.year - 60).isoformat()
        except ValueError:
            return d.replace(year=d.year - 60, day=28).isoformat()

    serial = 0

    def next_no():
        nonlocal serial
        serial += 1
        return f"UOK-N-{serial:05d}"

    for i, s in enumerate(staff):
        pin, off = pin_of.get(i), off_of.get(i)
        notes, sources = [], ["New Final 2026 List.xlsx"]
        designation, bps = nice_designation(s["designation"]), s["bps"]
        employee_no = None
        if pin:
            sources.append("1-16.pdf")
            if pin_count[pin["pin"]] == 1:
                employee_no = pin["pin"]
            else:
                notes.append(f"PIN {pin['pin']} appears more than once in the B-01–B-16 list.")
            if pin["bps"] and pin["bps"] != bps:
                notes.append(f"Budget book shows BPS-{bps}; staff list (1-16.pdf) shows B-{pin['bps']:02d}.")
                bps = pin["bps"]
        for lst, entry in (("B-01–B-16 staff list", pin), ("officers list", off)):
            if entry and name_key(entry["name"]) != name_key(s["name"]):
                notes.append(f"Matched by similar name to \"{entry['name']}\" ({entry['department']}) in the {lst} — please verify.")
        if off:
            sources.append("17 & above.pdf")
            if off["bps"] and off["bps"] != bps:
                notes.append(f"Budget book shows BPS-{bps} ({designation}); officers list shows B-{off['bps']}.")
                bps = off["bps"]
            designation = off["designation"]
        employees.append({
            "employee_no": employee_no or next_no(),
            "full_name": s["name"].title().replace("S/O", "s/o").replace("D/O", "d/o"),
            "gender": guess_gender(s["name"]),
            "staff_type": "Non-Teaching",
            "designation": designation,
            "bps": bps,
            "unit_code": s["unit_code"],
            "status": "Working",
            "status_remarks": None,
            "date_of_birth": derived_dob(s["date_of_retirement"]),
            "dob_derived": s["date_of_retirement"] is not None,
            "date_of_retirement": s["date_of_retirement"],
            "posting_label": off["department"] if off else s["posting_label"],
            "remarks": " ".join(notes) or None,
            "charges": [],
            "source": "; ".join(sources),
        })

    # people on the official lists who are not in the budget book
    taken = {e["employee_no"] for e in employees}
    added_pin = [p for j, p in enumerate(pins) if j not in pin_match]
    added_off = [p for j, p in enumerate(officers) if j not in off_match]
    for p in added_pin:
        unique = pin_count[p["pin"]] == 1 and p["pin"] not in taken
        taken.add(p["pin"])
        employees.append({
            "employee_no": p["pin"] if unique else next_no(),
            "full_name": p["name"].title(), "gender": guess_gender(p["name"]), "staff_type": "Non-Teaching",
            "designation": nice_designation(p["designation"]), "bps": p["bps"], "unit_code": list_unit(p["department"]),
            "status": "Working", "status_remarks": None, "posting_label": p["department"],
            "remarks": "Listed in the B-01–B-16 staff list but not in the 2026 budget book — date of birth / retirement not available."
                       + ("" if unique else f" PIN {p['pin']} is duplicated in the list."),
            "charges": [], "source": "1-16.pdf",
        })
    for p in added_off:
        employees.append({
            "employee_no": next_no(),
            "full_name": p["name"], "gender": guess_gender(p["name"]), "staff_type": "Non-Teaching",
            "designation": p["designation"], "bps": p["bps"], "unit_code": list_unit(p["department"]),
            "status": "Working", "status_remarks": None, "posting_label": p["department"],
            "remarks": "Listed in the BPS-17 & above officers list but not in the 2026 budget book — date of birth / retirement not available.",
            "charges": [], "source": "17 & above.pdf",
        })

    # DRG office staff -> employee records (prefer people posted in the DRG office itself)
    drg = parse_drg_office()
    drg_code = next(u["code"] for u in units if u["source_name"].upper().startswith("DEPUTY REGISTRAR (GENERAL"))
    nt = [e for e in employees if e["staff_type"] == "Non-Teaching"]
    for s in drg["staff"]:
        k = name_key(s["name"])
        pool = sorted(nt, key=lambda e: e["unit_code"] != drg_code)
        hit = next((e for e in pool if name_key(e["full_name"]) == k), None) or next(
            (e for e in pool if e["unit_code"] == drg_code and len(k) >= 6
             and (name_key(e["full_name"]).startswith(k) or k.startswith(name_key(e["full_name"]))
                  or difflib.SequenceMatcher(None, name_key(e["full_name"]), k).ratio() >= 0.9)), None)
        s["employee_no"] = hit["employee_no"] if hit else None

    rr = parse_recruitment_rules()
    establishment = parse_establishment()

    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(json.dumps({
        "generated_at": dt.datetime.now().isoformat(timespec="seconds"),
        "units": units, "budget_posts": posts, "employees": employees, "vacancies": vacancies,
        "establishment": establishment, "recruitment_rules": rr, "drg_office": drg,
    }, indent=1, ensure_ascii=False), encoding="utf-8")
    print(f"units={len(units)} posts={len(posts)} teachers={len(teachers)} non_teaching={len(staff)} vacancies={len(vacancies)}")
    print(f"PIN list={len(pins)} matched={len(pin_match)} added={len(added_pin)} | officers={len(officers)} "
          f"matched={len(off_match)} added={len(added_off)} | budget staff not on any list={len(staff) - len(used)}")
    print(f"establishment posts={len(establishment)} recruitment rules={len(rr['rules'])} "
          f"DRG sections={len(drg['sections'])} JDs={len(drg['job_descriptions'])} DRG staff={len(drg['staff'])} "
          f"(linked {sum(1 for s in drg['staff'] if s['employee_no'])})")
    print("teacher depts added outside budget book:", [u["name"] for u in units if u["sheet"] == "Faculty List"])


if __name__ == "__main__":
    main()
