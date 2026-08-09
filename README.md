# 🍜 Yum Thai Inventory
This was AI-assisted coding and README to use as a learning tool to understand API keys, JavaScript, app deployment, and AI limitations.
**AI‑assisted inventory tracking for a small restaurant — photograph a shelf, confirm the count, know what to reorder.**

![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-build-646CFF?logo=vite&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-backend-3ECF8E?logo=supabase&logoColor=white)
![PWA](https://img.shields.io/badge/PWA-installable-5A0FC8?logo=pwa&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-informational)

Yum Thai Inventory turns a phone photo of a storage shelf into a draft stock count. A vision model estimates what's on the shelf, a human confirms it in seconds, and the app tracks usage over time, flags what needs reordering, and warns about items about to expire. Built as a real‑world tool for a family‑owned Thai restaurant and used as a case study in applied AI product design.

> **Design principle:** the vision model *drafts*, a person *confirms*. Estimates are surfaced with an honest green/yellow/red confidence system rather than presented as fact — because counting real, cluttered shelves is genuinely hard.

---

## ✨ Features

- **📸 Photo‑assisted counting** — snap a shelf; the app returns a draft item list with quantities.
- **🚦 Confidence traffic light** — every item is flagged **green** (trusted), **yellow** (review), or **red** (unknown / unclear image), so you look exactly where the model is unsure.
- **🔁 Count vs. Add‑stock modes** — *Count* compares to the last count and shows what was used; *Add stock* increments inventory for restocks.
- **📊 Dashboard** — at‑a‑glance stock health, units on hand, reorder needs, and recent activity.
- **📦 Reorder points** — set a **Min** (reorder trigger) and **Max** (par level); the app tells you exactly how much to order (`Max − current`) and generates a copy‑paste supplier list.
- **⏳ Expiration tracking** — optional expiry dates with "expiring soon / expired" alerts.
- **📈 Usage forecast** — estimates days‑until‑out from consumption between counts.
- **🗺️ Storage map** — a draggable floor‑plan of the room so anyone can find where an item lives.
- **👥 User attribution** — every change is logged to a signed‑in user (who did what, when).
- **💾 CSV export** — one‑tap backup of the full inventory.
- **📱 Installable** — runs as a PWA on iPhone and Android; add to home screen and use like a native app.

---

## 🧠 How it works

```
  Phone (installed PWA)
        │  photo
        ▼
  React app ──► Serverless vision function ──► multimodal model
        │            (holds the API key)        returns structured JSON:
        │                                        { image_quality, items:[{name, qty,
        │                                          unit, confidence, note}] }
        ▼
  Traffic‑light review UI ──► user confirms/edits ──► Supabase (shared data + audit log)
```

The vision function returns a **fixed JSON contract**, and the UI renders it as confidence‑colored rows the user confirms. That contract is the seam that lets the estimate come from any provider (hosted API or a local model) without touching the interface.

---

## 🛠️ Tech stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite, Tailwind CSS, lucide‑react |
| Backend / Auth / Data | Supabase (Postgres, Auth, Row‑Level Security, Realtime) |
| Vision | Serverless Edge Function → multimodal vision API |
| Distribution | PWA (installable); optional Capacitor wrapper for App Store |
| Hosting | Vercel / Netlify |

---

## 📸 Screenshots

> _Add screenshots to `/docs` and link them here._

| Dashboard | Scan & confirm | Storage map |
|---|---|---|
| _`docs/dashboard.png`_ | _`docs/scan.png`_ | _`docs/map.png`_ |

---

## 🚀 Getting started

### Prerequisites
- Node.js 18+
- A [Supabase](https://supabase.com) project (free tier)
- A vision API key (e.g. Anthropic / OpenAI / Google)

### Quickstart
```bash
git clone https://github.com/<your-handle>/yum-thai-inventory.git
cd yum-thai-inventory
npm install
cp .env.example .env    # add your Supabase URL + anon key
npm run dev
```

> **Full setup** — a complete, step‑by‑step build (database schema, auth, the vision function, PWA, and deployment) is in [`docs/implementation-runbook.md`](docs/implementation-runbook.md). It's written to be followed top to bottom, with checkpoints.

### Environment variables
```
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-key
```
The **vision API key is never in the client** — it lives only in the Supabase Edge Function's secrets.

---

## 📱 Install on a phone

1. Open the deployed URL **in Safari** (iPhone) or Chrome (Android).
2. iPhone: **Share → Add to Home Screen**. Android: tap the **Install** prompt.
3. Open it from the home screen and sign in once with your email.

---

## 🗂️ Project structure

```
src/
  App.jsx          # the full app (dashboard, scan, inventory, map, activity)
  Auth.jsx         # magic‑link login gate
  supabase.js      # Supabase client
supabase/
  functions/
    analyze/       # serverless vision function (holds the API key)
docs/
  implementation-runbook.md
  deployment-guide.md
```

---

## 🧭 Roadmap

- [ ] Normalize storage into per‑row tables for true concurrent multi‑user editing
- [ ] Barcode scanning for packaged goods (near‑perfect, on‑device)
- [ ] Zones / categories (Dry · Fridge · Freezer) tied to the map
- [ ] Push notifications for reorder & expiry alerts
- [ ] Native App Store build via Capacitor
- [ ] Multi‑location / multi‑tenant support

---

## ⚠️ Status & limitations

This is a working prototype with a fully documented path to production.

- **Vision estimates are drafts.** Dense or occluded shelves reduce accuracy — that's *why* the confirm step and confidence colors exist. Always review before saving.
- The in‑repo prototype persists per device; shared multi‑user data requires the Supabase backend described in the runbook.
- Verify the current vision model ID and API pricing before going live.

---

## 🤝 Contributing

Issues and pull requests are welcome. For larger changes, open an issue first to discuss the direction.

---

## 📄 License

Released under the MIT License — see [`LICENSE`](LICENSE). 

---

## 🙏 Acknowledgements

Built as an applied‑AI case study for a family‑owned Thai restaurant. Not affiliated with or endorsed by any vision‑API provider. The traffic‑light confirmation pattern is a deliberate response to the real limits of automated shelf counting — surface uncertainty, keep a human in the loop.
