# University of Karachi — HRM System

Human Resource Management System for the Office of the Deputy Registrar (General), University of Karachi.
Next.js 16 (App Router) + PostgreSQL (Neon), styled with the UoK crest and colour scheme (maroon `#7c0405`, crimson `#d3224d`, navy `#081933`, gold `#d4af37`).

## Features

- **Dashboard** — staff totals, BPS distribution, faculty by designation, service status, upcoming retirements, vacancies.
- **Employees** — search/filter by name, employee no., CNIC, staff type, department, designation, BPS, status; CSV export.
- **Complete employee profile** — personal, contact, employment, pay & bank, photo, plus tabs for service history,
  administrative charges (Chairperson/Director/Dean terms), qualifications, experience, family, leaves and **documents**.
- **Document uploads** — multiple files per upload (PDF, images, Word, Excel; 10 MB each), categorised
  (CNIC, appointment letter, promotion order, degrees, etc.), stored in PostgreSQL; view/download/delete; central Documents library.
- **Departments & Offices** — 128 units with budgeted posts (approved Budget Book) vs staff on record, by BPS.
- **Vacant Positions** — non-teaching vacancy statements (BPS 1–16 and BPS 17+).
- **Retirements** — forecast by period and by year (superannuation at 60).
- **Printable profile sheet** on UoK letterhead.
- **Users & roles** — Admin (everything), HR Officer (add/edit records & documents), Viewer (read-only); activity log.

- **Establishment** — post-wise sanctioned strength of the non-teaching cadre (approved 2006-10 / after 2010 / abolished, working, vacant).
- **Recruitment Rules 2026** — eligibility, experience, age limit and job description for every BPS-17+ post, with current incumbents and vacancies.
- **DRG Office** — sections of the Office of the Deputy Registrar (General), staff assignments and job descriptions.

## Data imported

| Source file | Imported as |
|---|---|
| `new/New Final 2026 List.xlsx` (supersedes `Updated Budget.xlsx`) | 129 units, 1,037 budgeted post lines, 1,746 non-teaching employees |
| `List of Teachers 12-10-2026.xlsx` | 533 faculty members, status (S/L, F.S.L, UA, lien…), 90 administrative charges |
| `new/1-16.pdf` (staff list B-01 to B-16) | Official **PIN numbers** (used as employee no.) for 1,491 staff; 85 listed staff not in the budget book added |
| `new/17 & above.pdf` (officers list) | Current designation / scale / posting for 179 officers; 9 not in the budget book added |
| `Vacant Positions BPS-1 to BPS-16.pdf` | 100 vacancy lines |
| `new/bps-17.pdf` | 149 working / budgeted / vacant lines BPS-17+ with remarks (replaces the old BPS-17 vacancy PDF) |
| `new/Teaching Data.pdf` | 256 department-wise teaching position lines (1,037 sanctioned / 534 working) |
| `new/budget perofrma complete filled.xlsx` | 329 establishment post lines (2,662 approved posts) |
| `new/Recruitment-Rules-APPROVED.docx` | 102 post rules + general provisions |
| `new/DRG.pdf`, `new/JD'S OF DRG STAFF.pdf` | 10 sections, 7 job descriptions, 24 staff assignments |

Notes on the import:
- Non-teaching staff have only a retirement date in the budget book, so their **date of birth is derived** (retirement + 1 day − 60 years) and flagged "(derived)" in the profile.
- Faculty BPS is set from designation (Professor 21, Associate 20, Assistant 19, Lecturer 18).
- Staff lists are matched to the budget book by name (then BPS and office). Where the lists disagree on BPS, the staff/officers
  list is used and the budget-book value is kept in **Remarks**; matches on a spelling variant are also noted there ("please verify").
- Employee numbers are the official PIN where available; otherwise generated: `UOK-T-####` (teaching), `UOK-N-#####` (non-teaching).
- CNIC, contact, qualifications etc. are not in the source files — fill them in through the app.

## Setup

```bash
npm install
# .env.local
#   DATABASE_URL="postgresql://…"
#   SESSION_SECRET="<long random string>"
#   ADMIN_USERNAME="admin"   ADMIN_PASSWORD="<initial admin password>"
npm run db:seed        # create tables + load data/seed.json (skips data load if employees already exist)
npm run build && npm start
```

- `npm run data:extract` — re-generate `data/seed.json` from the source Excel/PDF files (needs Python with `openpyxl`, `pdfplumber` and `python-docx`; source files in the project root and `new/`).
- `npm run db:reset` — **drops all HRM tables (including uploaded documents)** and reloads the source data. User accounts are kept.

Sign in with the admin account from `.env.local` and change the password under **Users**.
