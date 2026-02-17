# Portfolio — Claude Code Instructions

## What This Project Is

Roland Huang's personal portfolio site at `index.html` — a single-page static HTML file with inline CSS and JavaScript. No build tools, no framework. Everything lives in one file.

**Live URL (pending GitHub Pages setup):** https://shimotakatote.github.io/huang-portfolio/

---

## Current State (as of Feb 2026)

The portfolio is largely complete. It includes:

- **8 project cards** with category filters (Integration / Automation)
- **Two skill rows** — Tech Stack & Platforms (grey) + AI Tools (purple)
- **Dark mode toggle** — persists via localStorage
- **Open Graph + Twitter Card meta tags** for link previews
- **SVG favicon** — "RH" initials on dark background
- **Mobile responsive** — tested at 390px (iPhone 14)
- **Footer** with email + © 2026

### Project Cards (in order)
1. AI Document Processing & Filing System — automation, client, 39–40 steps, dual AI (Gemini + OpenAI)
2. Intercom Sidebar — WHMCS Integration — integration, internal tool, Node.js/GCP/Docker
3. AI-Powered Intercom Escalation System — automation, internal tool, Gemini AI classification
4. Intercom Domain Attribute Service — integration, internal tool, Node.js/GCP/Docker
5. AI-Powered Meeting Notes Pipeline — automation, client, 7 connected zaps
6. Risk Management Alert System — automation, client, 22 steps, 5 branching paths
7. Community Event Registration Pipeline — automation, internal tool, Gravity Forms → Intercom
8. Asset Expiry Reminder System — automation, client, 3 zaps

---

## Key Files

| File | Notes |
|------|-------|
| `index.html` | The entire site — HTML, CSS, and JS in one file |
| `.gitignore` | Protects `exported-zaps-*.json`, `screenshots/`, `.claude/`, `.env` |
| `screenshots/` | Dev screenshots (excluded from git) — take new ones via the Selenium script below |
| `exported-zaps-*.json` | Sensitive Zapier exports — excluded from git, never commit these |

---

## Owner / Contact Info

- **Name:** Roland Huang
- **Email:** rolandbonhuang@gmail.com
- **GitHub:** https://github.com/Shimotakatote/
- **LinkedIn:** https://www.linkedin.com/in/roland-huang-1541533a4/
- **Location:** Sydney, Australia (not yet on site)

---

## Things NOT Done Yet (next priorities)

1. **Enable GitHub Pages** — Go to repo Settings → Pages → Deploy from `master` branch. Once live, the OG URL (`shimotakatote.github.io/huang-portfolio/`) will work.
2. **Experience section** — Add a brief work history entry (itGenius, role title, approximate duration) to make the page feel more resume-like. Roland said he wanted a resume-like feel but we haven't added this yet. **Ask Roland for his start date at itGenius before adding.**
3. **Location + availability line** — Adding "Sydney, AU · Open to new opportunities" near his name or tagline would help recruiters scanning the page.

---

## Design Rules & Conventions

- **Single file** — keep all CSS and JS inline in `index.html`. Do not create separate `.css` or `.js` files.
- **Category colors:** Integration = blue (`#3b82f6`), Automation = amber (`#f59e0b`)
- **AI Tools tags** = purple (`#7c3aed` light, `#a78bfa` dark mode)
- **Dark mode** uses `[data-theme="dark"]` CSS selectors on the `<html>` element
- **4 bullet points per card** — don't exceed this; it was trimmed down deliberately for scannability
- **No placeholder images** — image divs were removed. Don't add them back without real screenshots.
- **Intercom links** — any mention of Intercom should link to `https://www.intercom.com` using `style="color:inherit;text-decoration:underline;text-decoration-color:#ccc"`. Same for WHMCS → `https://www.whmcs.com`.

---

## Content Rules

- **Avoid company-specific internal terminology** — don't use internal project names, internal Zapier folder structures, or names of specific clients (mcaind, brownmanagement, itGenius internal tools are fine as "internal tool" or "client automation")
- **"Internal tool"** = built for itGenius (Roland's employer)
- **"Client automation"** = built for an external client via itGenius
- **Zapier export JSON files** — if Roland provides a new one, parse it with Node.js (see below). The JSON structure is `{ zaps: [...] }`. Each zap has a `nodes` object (keyed by ID, not an array — use `Object.values(zap.nodes).sort((a,b) => a.id - b.id)`). A zap is active if `firstNode.paused === false`.

---

## Taking Screenshots (Selenium)

Run from the portfolio directory:

```python
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
import os, time

opts = Options()
opts.add_argument('--headless')
opts.add_argument('--window-size=1280,900')
opts.add_argument('--force-device-scale-factor=1')

driver = webdriver.Chrome(options=opts)
path = os.path.abspath('index.html').replace(chr(92), '/')
driver.get('file:///' + path)
time.sleep(1)

height = driver.execute_script('return document.body.scrollHeight')
driver.set_window_size(1280, height + 100)
time.sleep(0.5)

os.makedirs('screenshots', exist_ok=True)
driver.save_screenshot('screenshots/latest-light.png')

driver.execute_script('document.documentElement.setAttribute("data-theme", "dark")')
time.sleep(0.5)
driver.save_screenshot('screenshots/latest-dark.png')
driver.quit()
```

For **mobile** (390px / iPhone 14): swap `--window-size=390,844` and `--force-device-scale-factor=2`.

Run as one-liner: `python -c "<script>"`
Requires: `pip install selenium` + Chrome installed.

---

## Parsing Zapier Export JSON

```js
const fs = require('fs');
const data = JSON.parse(fs.readFileSync('exported-zaps-XXXX.json', 'utf8'));
const zaps = data.zaps; // array

zaps.forEach((zap, i) => {
  const nodes = Array.isArray(zap.nodes)
    ? zap.nodes
    : Object.values(zap.nodes).sort((a, b) => a.id - b.id);
  const paused = nodes[0]?.paused;
  if (!paused) {
    console.log(i, zap.title, '| nodes:', nodes.length);
  }
});
```

---

## Git Workflow

```bash
git add index.html
git commit -m "Description of changes"
git push
```

Never commit:
- `exported-zaps-*.json` (sensitive API keys, webhook URLs)
- `screenshots/` (dev artifacts)
- `.claude/` (Claude Code internals)

---

## Recent Commit History

```
df6d4cd  Add AI tools section, expand platforms, add footer year
1683557  Remove company name from tagline
87eb35f  Add Open Graph meta tags and SVG favicon
97c0bde  Polish: stronger intro, WHMCS link, consolidate skills
8977654  Add 4 new project cards, reorder by impact, and trim bullet points
64ba8fc  Add skills grid, impact metrics, and polish project cards
845ca5f  Add automation projects, design refresh, and contact update
042b9e9  Add .gitignore and update profile links
```
