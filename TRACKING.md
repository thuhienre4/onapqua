# onapqua. affiliate tracking

How affiliate clicks, conversions and commissions are measured. The site is a Node.js
app (not WordPress), so tracking is built into the server instead of a plugin.

## Components

| File | Role |
|---|---|
| `tracking.js` | Central links, click log, transactions, reports, CSV parsing, GA4 Measurement Protocol |
| `server.js` | `/go/` redirects, page views, postback endpoint, admin API |
| `site.js` | Cookie consent, GA4 loader, browser events |
| `admin-tracking.html` / `.js` | Dashboard, link manager, transactions, import, settings, logs |
| `tests/tracking.test.js` | End-to-end tests (`node --test tests/tracking.test.js`) |

Data lives in `DATA_DIR` (Railway volume `/data`): `links.json`, `clicks.jsonl`,
`transactions.json`, `views.json`, `tracking-settings.json`.

## Affiliate links

- Public URL: `https://www.onapqua.com/go/<slug>/?c=<cta_position>`.
- Destinations are stored only on the server; the redirect never reads a destination from
  the query string (no open redirect). Destinations must be public `http(s)` URLs.
- Existing parameters in the affiliate URL are preserved.
- Optional per-link **sub-ID parameter** (defaults: Impact `subId1`, Awin `clickref`,
  CJ `sid`, ShareASale `afftrack`) receives a random click ID so conversions can be
  attributed back to the article and CTA.
- Status `active` / `paused`, optional expiry date and fallback URL.
- Redirect: HTTP **302**, `Cache-Control: no-store`, `X-Robots-Tag: noindex, nofollow`.
- Legacy URLs keep working: `/go/review/<postId>` and `/go/<offerId>`.
- Links are created automatically from each review's and offer's affiliate URL, and stay in
  sync when you edit those URLs in the Reviews or Coupons admin.

### CTA positions (`c=`)

`review_top`, `final_verdict`, `in_content`, `sticky_mobile`, `comparison_table`,
`alternatives_table`, `product_card`, `card`, `compare_tool`, `coupon_page`,
`review_deals`, `unknown`.

### What each click record stores

Timestamp, click ID, link, product, merchant, network, source article (from the
same-origin Referer), CTA position, device category, traffic source/medium/campaign
(only with consent), consent state, an anonymous session key and the GA client ID
(only with consent).

Not stored: IP addresses, user agents, names, emails, payment data. The session key is a
hash with a secret that rotates daily, used only to count unique clicks; it is omitted when
the visitor rejected cookies or sends Global Privacy Control. Bots, `HEAD` requests,
repeat clicks within 30 s and bursts over 20/min are not counted. Logs older than the
retention period (default 400 days) are deleted on start.

## Conversions

A click is never treated as a sale. Conversions come only from:

1. **Postbacks / webhooks:** `GET` or `POST` (JSON or form) to
   `https://www.onapqua.com/api/postback/<network>?token=<postback token>`.
   Fields: `tx` (transaction ID, required), `clickId`, `commission`, `amount`,
   `currency`, `status`, `linkId`, `merchant`, `product`, `date`. Ready-made templates for
   Impact, Awin, CJ, ShareASale, PartnerStack and direct programs are shown in
   **Admin → Tracking → Settings**. Rate limit: 120 requests/min per IP.
2. **CSV import:** **Admin → Tracking → Import** (preview first). Common network headers
   are recognized automatically.
3. **Manual entry:** **Admin → Tracking → Transactions**.

Deduplication key: network + transaction ID. Re-sending or re-importing updates the
status and amounts instead of creating duplicates. Statuses: `pending`, `approved`,
`rejected`, `reversed`. Reports count **approved** transactions only; other currencies
are reported separately from the reporting currency.

Direct API pulls from network APIs (Impact, Awin, CJ) are not implemented. They need
account-specific credentials; postbacks and CSV imports cover the same data.

## GA4

No GA4 tag existed before this change, so nothing is duplicated. Enter the Measurement ID
in **Admin → Tracking → Settings**. gtag loads **only** after the visitor clicks
"Accept analytics" (advertising signals denied).

| Event | Fired when | Main parameters |
|---|---|---|
| `affiliate_click` | Click on any `/go/` link | affiliate_id, affiliate_network, merchant_name, product_name, product_category, article_id, article_title, article_url, cta_position, cta_text, destination_domain, link_type |
| `coupon_click` | Coupon revealed or deal link clicked | coupon_id, merchant_name, cta_position, link_type=coupon |
| `product_view` | A review page is viewed | product_name, product_category, affiliate_id, merchant_name, article_id, article_title, rating |
| `comparison_view` | Compare tool shows ≥ 2 products, Best Software page, or a buyer's guide | comparison_type, products, product_count |
| `newsletter_signup` | Newsletter subscription succeeds | form_location |
| `affiliate_conversion` | A transaction becomes **approved** (server, Measurement Protocol) | transaction_id, value, currency, affiliate_id, affiliate_network, merchant_name, product_name, article_id, cta_position |
| `affiliate_refund` | A previously sent conversion becomes **reversed** | same, negative value |

`affiliate_conversion` and `affiliate_refund` are sent only when the GA4 API secret is
set, the click came from a visitor who consented (GA client ID known), and the
status change is confirmed by network data. Each is sent at most once per transaction.
GA4 cannot confirm merchant-side purchases by itself; it only receives what the
network reports.

Recommended GA4 setup: register the parameters above as event-scoped custom dimensions,
and mark `affiliate_click` and `affiliate_conversion` as key events.

## UTM parameters

Optional (Settings → "Append UTM parameters", off by default):
`utm_source=onapqua&utm_medium=affiliate&utm_campaign=product_review&utm_content=<cta>`.
Skipped when the destination already has `utm_source`. Test a link after enabling, since
some programs reject unknown parameters.

## Security

- Admin endpoints require the signed admin session; writes also require a same-origin
  `Origin`/`Referer` (CSRF protection alongside `SameSite=Lax` cookies).
- Postbacks require a secret token (timing-safe comparison); rotate it in Settings.
- The GA4 API secret and postback token are never sent to browsers.
- Server-only files (`tracking.js`, `render.js`, `tests/`, docs) are not served publicly.

## Test report (Nov 4, 2026)

`node --test tests/tracking.test.js` → **14 passed, 0 failed**.

| # | Test | Result |
|---|---|---|
| 1 | Existing affiliate URLs migrated to `/go/<slug>/`; parameters preserved | ✅ |
| 2 | Legacy `/go/review/:id` and `/go/:offerId` still redirect | ✅ |
| 3 | Click attributed to article, product, CTA and device; no IP stored | ✅ |
| 4 | Duplicate clicks and bots not counted | ✅ |
| 5 | Consent denied → no session key; granted → source attribution | ✅ |
| 6 | No open redirect; unknown slug → 404 | ✅ |
| 7 | Sub-ID appended; invalid destinations rejected; paused → fallback | ✅ |
| 8 | Postback token required; dedup by transaction ID; article attribution | ✅ |
| 9 | CSV preview/import/re-import without duplicates | ✅ |
| 10 | Reports count approved commissions only | ✅ |
| 11 | Admin API needs login; cross-site writes blocked | ✅ |
| 12 | Page views counted; SEO URLs, sitemap, robots OK; server files private | ✅ |
| 13 | GA4 ID only from settings; API secret never in pages | ✅ |
| 14 | CTA links carry position and analytics attributes; raw destination not exposed | ✅ |

Manually checked: dashboard rendering, consent banner on desktop, existing review/coupon
pages. Not testable here: live delivery to GA4 (needs your Measurement ID / API secret) and
real network postbacks (needs each network account).
