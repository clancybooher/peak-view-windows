# Site handoff: Yoncalla relocation

Paste-ready brief for a later implementation. Do not deploy this from the current git tree. Do not run `wrangler deploy`. This file does not change the live site.

Public NAP, everywhere a person can see it: **Yoncalla, OR · 541-639-3968 · clancy@peakvieworegon.com · CCB #260230**. No street. No ZIP code on the site or in schema.

Production is ahead of git commit `c46d5a3` (this repo’s `origin/main` on 23 Oct 2026). Live HTML, titles, and `robots.txt` are not the files in git. Start from a copy of what is actually deployed, or the next deploy will roll the live site backward.

While the business is dormant, titles and buttons must not promise a measure “this week” or a fast quote. Existing customers use the portal and the phone number.

## Schema (every page that embeds the business)

Delete `geo`, `GeoCircle`, `geo.position`, `geo.placename`, and `openingHoursSpecification` until spring. Do not add a Yoncalla map point.

`knowsAbout` can stay a list of services. It must not name Central Oregon towns.

```json
{
  "@type": "HomeAndConstructionBusiness",
  "@id": "https://peakvieworegon.com/#business",
  "name": "Peak View Windows & Doors",
  "telephone": "+1-541-639-3968",
  "email": "clancy@peakvieworegon.com",
  "url": "https://peakvieworegon.com",
  "address": {
    "@type": "PostalAddress",
    "addressLocality": "Yoncalla",
    "addressRegion": "OR",
    "addressCountry": "US"
  },
  "identifier": {
    "@type": "PropertyValue",
    "name": "Oregon CCB License",
    "value": "260230"
  },
  "areaServed": [
    {"@type": "City", "name": "Yoncalla"},
    {"@type": "City", "name": "Drain"},
    {"@type": "City", "name": "Elkton"},
    {"@type": "City", "name": "Oakland"},
    {"@type": "City", "name": "Sutherlin"},
    {"@type": "City", "name": "Roseburg"},
    {"@type": "City", "name": "Green"},
    {"@type": "City", "name": "Winston"},
    {"@type": "City", "name": "Cottage Grove"},
    {"@type": "City", "name": "Creswell"}
  ]
}
```

No `streetAddress`. No `postalCode`. Do not list “Douglas County” as the area. The county includes Reedsport, about 86 minutes from Yoncalla on the route checked for this audit. Add Myrtle Creek, Glide, or Canyonville only after Clancy confirms he will drive there. Those three were past 60 minutes.

City landers today put `addressLocality: "Bend"` on `provider`. Point `provider` at `https://peakvieworegon.com/#business` and do not repeat a second address.

## Titles, descriptions, H1s

| URL | Title | Meta description | H1 |
| --- | --- | --- | --- |
| `/` | Window Replacement in Yoncalla, Oregon \| Peak View | Window and door replacement for Yoncalla and nearby Douglas County towns. Andersen 100 Series, measured and installed by our crew. Call 541-639-3968. CCB #260230. | Window replacement in Yoncalla, Oregon |
| `/windows` | Window Replacement in Douglas County \| Peak View | Andersen window replacement for homes in Yoncalla, Sutherlin, Roseburg, and nearby towns. Call 541-639-3968. CCB #260230. | Window replacement for Douglas County homes |
| `/doors` | Door Replacement in Douglas County \| Peak View | Entry, patio, and French door replacement in Yoncalla and Douglas County. Call 541-639-3968. CCB #260230. | Door replacement in Yoncalla and Douglas County |
| `/andersen` | Andersen Windows in Douglas County \| Peak View | Andersen 100 Series for most Douglas County homes. 400 Series when you want wood inside. Call 541-639-3968. CCB #260230. | Andersen window replacement in Douglas County |
| `/about` | Meet the Owners \| Peak View Windows & Doors | Clancy and Naomi Booher own Peak View Windows & Doors in Yoncalla, Oregon. CCB #260230. | Meet the owners |
| `/gallery` | Our Work \| Peak View Windows & Doors | Photos of window and door installs. Call 541-639-3968. Serving Yoncalla and nearby towns. CCB #260230. | Our work |
| `/faq` | FAQ \| Peak View Windows & Doors | Answers on window and door replacement in Douglas County. Call 541-639-3968. CCB #260230. | Common questions |
| `/blog` | Window Guides \| Peak View Windows & Doors | Notes on window replacement, cost, and materials. Call 541-639-3968. CCB #260230. | Window replacement, explained |
| `/contact` | Contact \| Peak View Windows & Doors | Peak View is not scheduling new installs until spring. Existing customers: call 541-639-3968 or email clancy@peakvieworegon.com. Yoncalla, OR. CCB #260230. | We are not scheduling new installs until spring |
| `/contract` | keep the current title | keep the current description | keep the current H1 |

`/contract` is `index, follow` on the live site and is in the sitemap. Set `noindex, follow`, take it out of the sitemap, and change any Bend or Central Oregon sentences. Leave the warranty terms alone.

`/automations` stays `noindex` and off the sitemap. Do not edit it for this move.

On `/about`, delete the lines that say they relocated to Bend and that they serve Central Oregon within about 50 miles of Bend.

On `/contact`, while dormant: hide or replace the quote form. Keep phone, email, and a link to the customer portal. Do not write a street.

Strip Central Oregon climate claims (high desert, 3,600-foot elevation, Bend temperature swings, climate-zone numbers). Do not invent a Douglas County temperature range. Say the work is for homes in Yoncalla and the Umpqua valley towns listed above.

`geo.region` may stay `US-OR`. Delete `geo.placename` and `geo.position`.

## New pages

Build these at the same time as the redirects. Apex paths only.

| URL | Title | Meta description | H1 | Primary keyword |
| --- | --- | --- | --- | --- |
| `/window-replacement-douglas-county-oregon` | Window Replacement in Douglas County, Oregon \| Peak View | Window replacement out of Yoncalla for Roseburg, Sutherlin, Drain, Winston, and nearby towns. Call 541-639-3968. CCB #260230. | Window replacement in Douglas County, Oregon | window replacement Douglas County Oregon |
| `/window-replacement-roseburg-oregon` | Window Replacement in Roseburg, Oregon \| Peak View | Window replacement in Roseburg. Andersen 100 Series, measured and installed by our crew from Yoncalla. Call 541-639-3968. CCB #260230. | Window replacement in Roseburg, Oregon | window replacement Roseburg Oregon |
| `/window-replacement-sutherlin-oregon` | Window Replacement in Sutherlin, Oregon \| Peak View | Window replacement in Sutherlin and nearby Oakland. Free in-home measure when scheduling is open. Call 541-639-3968. CCB #260230. | Window replacement in Sutherlin, Oregon | window replacement Sutherlin Oregon |
| `/window-replacement-cottage-grove-oregon` | Window Replacement in Cottage Grove, Oregon \| Peak View | Window replacement in Cottage Grove, Lane County, from our Yoncalla crew. Call 541-639-3968. CCB #260230. | Window replacement in Cottage Grove, Oregon | window replacement Cottage Grove Oregon |
| `/window-replacement-yoncalla-oregon` | Window Replacement in Yoncalla, Oregon \| Peak View | Window replacement in Yoncalla, Drain, and Elkton. Peak View Windows & Doors. Call 541-639-3968. CCB #260230. | Window replacement in Yoncalla, Oregon | window replacement Yoncalla Oregon |

Second wave, after the first five are up: `/window-replacement-winston-oregon`, `/window-replacement-creswell-oregon`, `/window-replacement-drain-oregon`. Same pattern: `{Town}` in title, H1, and keyword. Creswell’s meta must say Lane County.

Do not build a Green page in the first wave. Mention Green on the Roseburg page. Oakland goes on the Sutherlin page. Elkton goes on the Yoncalla page.

Do not clone a door lander per town. `/doors` is the door URL. One Roseburg door page can wait until Search Console shows door-plus-city queries. There is no Search Console export in this audit.

Each new city page: one `Service` with `areaServed` set to that city, `provider` `@id` pointing at the business, FAQ only about that town, no “we drive from Bend.”

## 301 map

Do these in the worker, one hop, to the apex host. Add them only in the same deploy that publishes the target.

| From | To |
| --- | --- |
| `/window-replacement-redmond-oregon` | `/window-replacement-douglas-county-oregon` |
| `/window-replacement-sisters-oregon` | `/window-replacement-douglas-county-oregon` |
| `/window-replacement-sunriver-oregon` | `/window-replacement-douglas-county-oregon` |
| `/window-replacement-la-pine-oregon` | `/window-replacement-douglas-county-oregon` |
| `/window-replacement-prineville-oregon` | `/window-replacement-douglas-county-oregon` |
| `/blog/window-replacement-redmond-oregon` | `/window-replacement-douglas-county-oregon` |
| `/blog/window-replacement-sunriver-oregon` | `/window-replacement-douglas-county-oregon` |
| `/patio-door-replacement-bend-oregon` | `/doors` |
| `/entry-door-replacement-bend-oregon` | `/doors` |
| `/blog/window-replacement-cost-bend-oregon` | `/blog/window-replacement-cost` |
| `/blog/why-replace-windows-bend-oregon` | `/blog/why-replace-windows` |
| `/blog/foggy-windows-bend-oregon` | `/blog/foggy-windows` |
| `/blog/vinyl-vs-fiberglass-windows-bend-oregon` | `/blog/vinyl-vs-fiberglass-windows` |
| `/blog/vinyl-vs-fibrex-windows-bend-oregon` | `/blog/vinyl-vs-fibrex-windows` |
| `/blog/pella-impervia-fiberglass-windows-bend-oregon` | `/blog/pella-impervia-fiberglass-windows` |

Rewrite the six evergreen posts at the new slugs. Drop Bend from the title, H1, and climate sections. Keep the product comparison. Update `blog/posts.json` slugs to match, or the blog index will link to dead URLs.

Do not redirect a Central Oregon city URL to Roseburg or any other single town.

Keep the existing pretty-URL redirects (`www` to apex, `.html` to the extensionless path, `/index.html` to `/`).

## Sitemap

Remove every URL in the 301 table. Remove `/contract`. Keep `/automations` out.

Add `/window-replacement-douglas-county-oregon` and the four first-wave city URLs, plus the six new blog slugs when those pages exist.

`lastmod` on the current sitemap is August–September 2026. Set `lastmod` on the new URLs to the deploy date.

## Footer and nav

Nav today is Home, Windows, Doors, Our Work, About, Blog. Leave cities out of the nav.

Replace the footer service-area block on every public page:

- Blurb: `Window and door replacement out of Yoncalla. CCB #260230.`
- NAP: `Yoncalla, OR` / `541-639-3968` / `clancy@peakvieworegon.com` / `CCB #260230`
- Links: Yoncalla, Drain, Sutherlin, Roseburg, Winston, Cottage Grove, Creswell, and `Douglas County` pointing at the hub. Drop Bend, Redmond, Sisters, Sunriver, La Pine, Prineville, Tumalo, Terrebonne.
- Copyright line: `Yoncalla, Oregon`
- Delete “Serving Bend, Redmond, Sisters, Sunriver, La Pine, Tumalo, Prineville, Terrebonne & all of Central Oregon.”
- Delete the footer sentence “Window replacement for Central Oregon homes. Bend-based.”
- Service column: Patio Door and Entry Door should point at `/doors`, not the Bend landers.

The live homepage links the word Bend to `#contact`. That anchor goes away with the Bend label.

## Downtime, with the portal left up

Public site off for one to two days. Google’s own guidance for an urgent shutdown is a `503` with `Retry-After`, for a day or two, not a `404` and not a `200` placeholder that looks like the real page. A few weeks on `503` is long enough for URLs to drop out of the index.

In `worker.js`, before the asset fetch, for GET/HEAD on the apex host:

- `503` and `Retry-After` set to the hour the site is due back (HTTP date).
- Static HTML in the body: Yoncalla, the phone, the email, the date the site returns, and a link to `https://portal.peakvieworegon.com/`. Say new installs are paused. No street. No Bend.
- Copy the existing `google-site-verification` meta from the live homepage onto that `503` body so the Search Console property stays verified. The tag is already public on `/`.
- Return `200` for `/robots.txt` and `/sitemap.xml`. Do not answer those with `503`. Do not change robots to `Disallow: /`.
- Do not send `noindex` or `X-Robots-Tag: noindex` on the public URLs.
- Do not `404` or `410` the public URLs during this window.
- Leave `/api/submit` alone if the form is disabled in the HTML. A `503` on the form is fine if the form is not offered.
- Do not `503` `portal.peakvieworegon.com` or `quotes.peakvieworegon.com`. They are not this worker. Confirm both still answer after the apex change.

If the outage slips past two days, stop the `503`. Publish a `200` homepage that explains the pause and links to the portal, and keep the rest of the URLs `503` only if they cannot be the new copy yet. Do not use the Search Console removals tool. Do not delete the property.

## Portal

Not in this repo. Login is `https://portal.peakvieworegon.com/` (HTTP 401 with an HTML login). `https://quotes.peakvieworegon.com/` is the same login. Cookie name `pvhub`. Linked paths include `/account` and `/account/phone`.

The login page has no `noindex`. Its robots.txt, after Cloudflare’s managed block, does not disallow the host. The visible chrome says Bend, Oregon.

Separate change, in the portal project: add `noindex, nofollow` on the login shell, and change the visible town to Yoncalla. Do not take the portal down for the apex outage.

## Search Console and ads (not site code)

- Do not remove the property. After the site returns, submit the new sitemap and inspect the homepage, `/windows`, `/doors`, the county hub, and one redirected city URL.
- Local Services Ads stay paused. Before any re-enable, set the ads service area to the same city list as schema, and only after the site and the Business Profile match.
