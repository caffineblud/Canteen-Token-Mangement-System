# Canteen Token Management System (Group 10)

Token generation, counter order queue and daily sales tracking for a canteen.
Static web app (HTML + CSS + JS). No build step, no dependencies.

## Modules
| # | Module | Where |
|---|--------|-------|
| 1 | Menu and price list | **Menu** tab (admin can add/edit/delete/mark sold out) |
| 2 | Token generation | **Order** tab → "Pay & generate token" (T-001, T-002… resets daily) |
| 3 | Order queue for counter | **Queue** tab (FIFO: Queued → Preparing → Ready → Served) |
| 4 | Billing | Cart totals, discount (admin), 5% GST, printable slip |
| 5 | Daily sales report | **Sales** tab: KPIs, charts, order table, CSV export |

Admin login (demo): `admin` / `admin123`. This is client-side only, so it is a convenience lock for a demo, not real security.
Data is stored in the browser (localStorage). Open the app in two tabs to see the queue update live.

## Deploy

### Netlify (drag and drop, fastest)
1. Go to https://app.netlify.com/drop
2. Drag this whole folder onto the page. Done, you get a live URL.

### Vercel
Option A, CLI:
```
npm i -g vercel
cd canteen-token-system
vercel --prod
```
(Answer the prompts: no framework, output directory `.`)

Option B, GitHub: push this folder to a repo, then import it at https://vercel.com/new. Framework preset: **Other**. Leave build command empty.

## Run locally
Open `index.html` in a browser, or run `npx serve .`
