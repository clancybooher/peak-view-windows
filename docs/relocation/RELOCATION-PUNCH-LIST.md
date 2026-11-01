# Relocation punch list: Bend to Yoncalla

Audit date: 23 October 2026. Peak View Windows & Doors (Clancy LLC, Oregon CCB #260230). This is documentation only. Nothing here was deployed.

Public NAP to use from now on: Yoncalla, OR · 541-639-3968 · clancy@peakvieworegon.com · CCB #260230. No street address is written in this report. The live site also has none: zero `streetAddress` keys, zero `postalCode` keys, and zero street-like patterns in the fetched HTML.

Two facts change how the rest of this should be implemented.

Git commit `c46d5a3` (`origin/main`, “Drop luxury phrasing from homepage SEO”) is behind the live site. Every public HTML file fetched from https://peakvieworegon.com differed in bytes from the same path in git. Live pages use `styles.css?v=21`, a different meta description on the homepage, and `photos/og-peak-view.jpg`. The repo still has `styles.css?v=16` and older descriptions. `git fetch origin main` showed zero commits ahead of this checkout. A deploy from this tree would roll production backward. Counts below are from the live HTML unless a row says repo.

`/automations` is out of scope. It is live, `noindex, follow`, canonical `https://peakvieworegon.com/automations`, absent from the sitemap, and disallowed in the live robots.txt. It has no Bend or Central Oregon wording. Leave it.

## 1. What was audited

Fetched 23 Oct 2026 with curl, status 200 unless noted:

- All 25 URLs in https://peakvieworegon.com/sitemap.xml. The live sitemap matched `sitemap.xml` in git byte for byte.
- `/robots.txt`, `/automations`, `/404` (the missing-page template; a nonsense path returns 404).
- The same HTML files in git, plus `blog/posts.json`, and three backups that `.assetsignore` keeps off the worker: `future-changes/process-section-backup.html`, `future-edits/door-variants-backup.html`, `future-edits/window-variants-backup.html`.
- Portal hosts, probed separately. They are not in this repo.

Counts are case-insensitive regex hits on tag-stripped text. Script and style are excluded. “Outside footer” means the body before the first `<footer>`. Head counts are the title and other text inside `<head>` after tags are stripped, so they miss some meta attributes. Meta descriptions are quoted separately.

### Portal

There is no portal, login, customer, or account route in this repo. `worker.js` only special-cases `/api/submit` and canonical redirects. Probes of `/portal`, `/customer`, `/login`, `/account`, `/quotes`, `/notes`, and similar apex paths returned 404. `/notes` is disallowed in live robots.txt and still 404s.

The customer portal is another hostname:

| Host | What came back |
| --- | --- |
| `https://portal.peakvieworegon.com/` | HTTP 401, HTML login. Title and H1: “Peak View portal login”. No meta description, no canonical, no robots meta. |
| `https://portal.peakvieworegon.com/account` | HTTP 401, same app |
| `https://portal.peakvieworegon.com/robots.txt` | 200. Cloudflare’s managed block, then nothing. The effective rule is `Allow: /`. |
| `https://quotes.peakvieworegon.com/` | HTTP 401, same login HTML. Cookie name `pvhub`. |

The login page links to `/account`, `/account/phone`, `https://peakvieworegon.com`, `tel:+15416393968`, and `mailto:clancy@peakvieworegon.com`. Visible text says “Bend, Oregon” twice (header and footer) and “Clancy LLC · CCB #260230”. No street. It is not `noindex`.

Other hostnames tried (`customer`, `app`, `pay`, `client`, `hub`, `admin`, `api`) did not resolve. `www.peakvieworegon.com` 301s to the apex, which the worker already does.

### Robots and sitemap

Repo `robots.txt` is only `Allow: /` plus the sitemap line.

Live `robots.txt` adds Cloudflare’s managed content-signal block and, after that block:

```
Disallow: /automations
Disallow: /notes
Disallow: /notes/
Sitemap: https://peakvieworegon.com/sitemap.xml
```

Sitemap entries (25), `lastmod` in parentheses: `/` (2026-09-09), `/windows`, `/andersen`, `/doors`, `/gallery`, `/about`, `/faq`, `/contact`, `/contract`, five Central Oregon window landers, `/patio-door-replacement-bend-oregon`, `/entry-door-replacement-bend-oregon` (those through `/contract` are 2026-09-09 except as noted), `/blog` (2026-09-08), and eight blog posts from 2026-08-04 through 2026-09-08. `/automations` is not listed. `/contract` is listed even though the repo file says `noindex`. On the live site `/contract` is `index, follow`.

Nav on the live homepage: Home, Windows, Doors, Our Work, About, Blog. No city links.

Footer, repeated across the public pages: “Window replacement for Central Oregon homes. Bend-based.” NAP line “Bend, OR”. Copyright “Bend, Oregon”. Sentence “Serving Bend, Redmond, Sisters, Sunriver, La Pine, Tumalo, Prineville, Terrebonne & all of Central Oregon.” City links: Bend → `#contact` on the live homepage (the repo file still points Bend at `/contact`), Redmond, Sisters, Sunriver, La Pine, and Prineville → their landers, Tumalo and Terrebonne → `/contact`. Service column links the two Bend door landers.

### Reference counts

25 sitemap URLs, live HTML, visible body. Automations and the 404 page are not in these totals. Both of those pages are zero for every term.

| Term | Body | Outside footer | Footer | Head text |
| --- | ---: | ---: | ---: | ---: |
| Bend | 356 | 231 | 125 | 17 |
| Central Oregon | 126 | 83 | 43 | 0 |
| Deschutes | 3 | 3 | 0 | 0 |
| high desert / high-desert | 11 | 11 | 0 | 0 |
| Redmond | 143 | 93 | 50 | 2 |
| Sisters | 103 | 53 | 50 | 1 |
| Sunriver | 95 | 46 | 49 | 2 |
| La Pine | 72 | 23 | 49 | 1 |
| Prineville | 70 | 21 | 49 | 1 |
| Tumalo | 50 | 1 | 49 | 0 |
| Terrebonne | 50 | 1 | 49 | 0 |
| SROA | 5 | 5 | 0 | 0 |

The footer is why Tumalo and Terrebonne look large. Outside the footer they appear once each. SROA appears on the Sunriver lander (1), the blog index (1), and the Sunriver blog post (3).

Also in visible text, not in the table: “Crook County” 5 times, all on the Prineville lander. “50 miles” 10 times across nine pages, in the line about serving Central Oregon within about 50 miles of Bend. “Bend-based” 18 times, mostly the footer blurb and meta descriptions.

In JSON-LD only (stripped out of the body counts): Powell Butte, Crooked River Ranch, Madras, Deschutes County, Jefferson County, and a GeoCircle. Crook County is both in the Prineville copy and in the homepage `areaServed` list.

`blog/posts.json` has the same eight slugs as the sitemap. Bend hits inside those JSON records: Sunriver post 8, Pella 12, Fibrex 9, Redmond 21, cost 9, vinyl vs fiberglass 6, foggy 11, why-replace 10. The blog index is driven by this file. New slugs have to land here or the index will keep linking at Bend URLs.

The three ignored backup templates are not public. Bend hits: process backup 0, door-variants backup 1, window-variants backup 2. No action until someone promotes them.

### Per-page live SEO

Every sitemap URL is `index, follow` except where noted. Canonical is the apex pretty URL. `geo.region` is `US-OR` on the marketing pages. `geo.placename` is “Bend, Oregon” on core pages, door landers, and every blog post, and is the city name on the five window landers. Only `/` also has `geo.position` (`44.0582;-121.3153`).

“Bend (out)” is body hits, then the count outside the footer.

| URL | Title | H1 | Bend (out) | Central Oregon (out) | Notes |
| --- | --- | --- | --- | --- | --- |
| `/` | Window Replacement Bend Oregon \| Peak View Windows & Doors | Window Replacement in Bend, Oregon | 12 (7) | 9 (7) | High desert in the hero. Meta differs from git. |
| `/windows` | Replace Windows in Bend, Oregon \| Peak View Windows & Doors | Replace Your Windows. Lower Your Bills. Quiet Your Rooms. | 16 (11) | 7 (5) | High desert 2. Meta differs from git. |
| `/andersen` | Andersen Windows in Bend, OR \| Peak View | Andersen Window Replacement in Bend, Oregon | 13 (8) | 9 (7) | Climate zone, degree figures, high desert. Title and meta differ from git. |
| `/doors` | Door Replacement Bend Oregon \| Peak View Windows & Doors | Your Doors Are Letting in the Cold. | 13 (8) | 5 (3) | Title matches git. |
| `/blog` | Window Guides for Bend, OR \| Peak View | Window Replacement, Explained | 17 (12) | 8 (6) | SROA 1. Title and meta differ from git. |
| `/gallery` | Our Work \| Peak View Windows & Doors - Bend, Oregon | Our Work | 10 (5) | 5 (3) | Meta differs from git. |
| `/about` | Meet the Owners \| Peak View Windows & Doors - Bend, Oregon | Meet the Owners | 10 (5) | 4 (2) | Says they brought the business to Bend, and serves within about 50 miles of Bend. |
| `/faq` | FAQ \| Peak View Windows & Doors - Bend, Oregon | Common Questions | 9 (4) | 5 (3) | High desert 1. Meta differs from git. |
| `/contact` | Free Quote in Bend, OR \| Peak View | Get a Free In-Home Quote | 9 (4) | 3 (1) | Title differs from git. |
| `/contract` | Contract & Warranty Terms \| Peak View Windows & Doors | Installation Contract & Warranty Terms | 8 (3) | 2 (0) | Deschutes 2. Live robots `index, follow`. Repo file says `noindex, follow`. In the sitemap. |
| `/window-replacement-redmond-oregon` | Window Replacement Redmond, OR \| Peak View | Window Replacement in Redmond, Oregon | 13 (8) | 2 (1) | Redmond 26. Title and meta differ from git. |
| `/window-replacement-sisters-oregon` | Window Replacement Sisters, OR \| Peak View | Window Replacement in Sisters, Oregon | 13 (8) | 2 (1) | Sisters 21. Meta cites elevation and snow. |
| `/window-replacement-sunriver-oregon` | Window Replacement Sunriver, OR \| Peak View | Window Replacement in Sunriver, Oregon | 11 (6) | 2 (1) | Sunriver 21. SROA 1. Meta says scheduling from Bend. |
| `/window-replacement-la-pine-oregon` | Window Replacement La Pine, OR \| Peak View | Window Replacement in La Pine, Oregon | 11 (6) | 2 (1) | La Pine 18. |
| `/window-replacement-prineville-oregon` | Window Replacement Prineville, OR \| Peak View | Window Replacement in Prineville, Oregon | 15 (10) | 2 (1) | Prineville 17. Crook County in the copy. Meta says measured from Bend. |
| `/patio-door-replacement-bend-oregon` | Patio Doors in Bend, OR \| Peak View | Patio Door Replacement in Bend, Oregon | 16 (11) | 2 (1) | |
| `/entry-door-replacement-bend-oregon` | Entry Doors in Bend, OR \| Peak View | Entry Door Replacement in Bend, Oregon | 15 (10) | 2 (1) | Meta says high-desert weather. |
| `/blog/window-replacement-sunriver-oregon` | Sunriver Vacation Homes \| Peak View | Window Replacement in Sunriver, Oregon | 16 (11) | 5 (3) | SROA 3. |
| `/blog/pella-impervia-fiberglass-windows-bend-oregon` | Pella Impervia in Bend, OR \| Peak View | Pella Impervia Fiberglass Windows in Bend, OR | 19 (14) | 6 (4) | 3,600-foot elevation, degree figures. |
| `/blog/vinyl-vs-fibrex-windows-bend-oregon` | Vinyl vs Fibrex in Bend, OR \| Peak View | Vinyl vs Fibrex Windows for Bend, Oregon | 16 (11) | 6 (4) | Elevation and degree figures. |
| `/blog/window-replacement-redmond-oregon` | Redmond Window Notes \| Peak View | Window Replacement in Redmond, Oregon | 29 (24) | 7 (5) | Redmond 35. Deschutes 1. Climate-zone mentions 4. |
| `/blog/window-replacement-cost-bend-oregon` | Window Cost in Bend, OR \| Peak View | What Drives Window Replacement Cost in Bend, Oregon | 16 (11) | 4 (2) | |
| `/blog/vinyl-vs-fiberglass-windows-bend-oregon` | Vinyl vs Fiberglass in Bend, OR \| Peak View | Vinyl vs. Fiberglass Windows in Central Oregon | 13 (8) | 11 (9) | |
| `/blog/foggy-windows-bend-oregon` | Foggy Windows in Bend, OR \| Peak View | Foggy Windows in Bend, Oregon: What They Mean | 18 (13) | 6 (4) | 3,600-foot elevation, high desert. |
| `/blog/why-replace-windows-bend-oregon` | Why Replace Windows in Bend, OR \| Peak View | Why Window Replacement in Bend, Oregon Pays Off | 18 (13) | 10 (8) | High desert 3. |

OG and Twitter descriptions track the meta description. Live OG image is `https://peakvieworegon.com/photos/og-peak-view.jpg` with width 1200 and height 630. The repo still points several pages at an Andersen photo.

### JSON-LD

Homepage `@type` is `HomeAndConstructionBusiness`, name “Peak View Windows & Doors”, phone `+1-541-639-3968`, email `clancy@peakvieworegon.com`. Address is only `addressLocality: Bend`, `addressRegion: OR`, `addressCountry: US`. Description on that node is still “Window replacement for Central Oregon homes. Bend-based. CCB #260230.” which is older than the live meta description. Identifier is CCB 260230. Founder is Clancy Booher. `knowsAbout` is services only (window and door replacement, Andersen 100 and 400, millwork). That list can stay.

`areaServed` on `/`: Bend, Redmond, Sisters, Sunriver, La Pine, Tumalo, Prineville, Terrebonne, Powell Butte, Crooked River Ranch, Madras, plus AdministrativeArea values Central Oregon, Deschutes County, Crook County, and Jefferson County, plus a GeoCircle. `geo` is GeoCoordinates `44.0582, -121.3153`. The circle uses the same point and `geoRadius` 80000 (80 km, the “about 50 miles” claim). Opening hours are Mon–Fri 07:00–18:00 and Saturday 08:00–14:00.

`/windows`, `/doors`, and `/andersen` each have a `Service` whose `areaServed` repeats Bend, Redmond, Sisters, Sunriver, La Pine, Prineville, Tumalo, Terrebonne, and Central Oregon.

Each Central Oregon window lander and both Bend door landers embed `provider` as a `HomeAndConstructionBusiness` with `addressLocality: Bend`, and set `areaServed` to that one city. Breadcrumbs and FAQ questions name the Central Oregon city.

Blog posts are `Article` plus `FAQPage` and breadcrumbs. Their `geo.placename` is Bend even when the article is about Redmond or Sunriver.

No page uses `streetAddress` or `postalCode`.

## 2. What to do with each Bend reference

I do not have Search Console impressions, so this is not a traffic-weighted call. Sitemap `lastmod` values are August and September 2026. That is the only age signal in the repo. The pages are young, and they assert a service area the company is leaving. A city name baked into the URL cannot be honestly retitled to a different town.

Do not 301 Redmond (or Sisters, Sunriver, La Pine, Prineville) to Roseburg. Those are different queries. Send the window URLs to one new page about the same service in the new region, and send the door URLs to `/doors` after `/doors` is rewritten.

| Item | Action |
| --- | --- |
| `/`, `/windows`, `/doors`, `/andersen`, `/about`, `/gallery`, `/faq`, `/blog`, `/contact` | Rewrite in place. New title, description, and H1 are in `SITE-HANDOFF.md`. |
| Footer, nav service column, “50 miles of Bend”, “Bend-based” | Rewrite on every page. Nav has no cities; leave it that way. |
| Homepage `geo`, `GeoCircle`, `geo.position`, hours | Delete. Do not add a Yoncalla coordinate. Drop hours until spring so the site does not say “open” while the profile says temporarily closed. |
| `areaServed` and `addressLocality` | Replace with the Yoncalla block in the handoff. |
| Five window landers and both Bend door landers | 301. Remove from the sitemap in the same deploy. |
| Sunriver and Redmond blog posts | 301 to the new county hub. They exist to rank a town Peak View will not serve. SROA and Sunriver HOA copy goes with them. |
| Six evergreen posts (cost, why replace, foggy, vinyl vs fiberglass, vinyl vs Fibrex, Pella) | Keep the explanations. 301 to slugs with no city. Rewrite climate sections without new made-up temperatures. |
| `/contract` | Keep the URL. `noindex`, remove from sitemap, edit only the geography sentences. |
| `/automations`, 404 template | No relocation edit. |
| Tumalo, Terrebonne, Powell Butte, Madras, Crooked River Ranch, Deschutes, Crook, Jefferson | No replacement landers. They are Central Oregon. Delete the mentions. |
| Portal login chrome | Out of repo. Change “Bend, Oregon” to Yoncalla and add `noindex`. |

### Old landers and Bend blog posts

Retire the five window landers and the two door landers. Rewriting them into Douglas County pages would leave “redmond” in the URL. `noindex` alone leaves a URL that still ranks for a city the company left, until Google drops it. A 301 to the matching service page is the cleaner end.

The county hub `/window-replacement-douglas-county-oregon` is the window target because it is the same job in the new region. `/doors` is the door target. Build the hub in the same release as the redirects so the target is a real page, not a soft 404.

The Redmond and Sunriver posts duplicate those landers. Same 301.

The other six posts answer material and cost questions that are still useful. The Bend slug is the problem, not the whole article. Move them and strip the high-desert claims. The foggy-window and Fibrex posts currently lean on a 3,600-foot elevation figure and a Bend temperature swing. Do not replace those numbers with an invented Roseburg range.

### Schema to ship

Use the JSON block in `SITE-HANDOFF.md`. In short: `addressLocality` Yoncalla, `addressRegion` OR, `addressCountry` US, no street, no postal code, no geo. `areaServed` is Yoncalla, Drain, Elkton, Oakland, Sutherlin, Roseburg, Green, Winston, Cottage Grove, and Creswell. Cottage Grove and Creswell are Lane County; say that in the visible sentence on those pages, not by adding a Lane County `AdministrativeArea` that would cover Eugene and Springfield.

`knowsAbout` stays the service list. CCB identifier stays. Delete opening hours until the spring reopen.

## 3. Towns within about an hour of Yoncalla

Populations are the 1 April 2020 Census unless noted.

Places of 5,000 or more, plus Green CDP, are from the Census Bureau QuickFacts table fetched 23 Oct 2026 (`Sutherlin city`, `Roseburg city`, `Winston city`, `Cottage Grove city`, `Creswell city`, `Green CDP`). QuickFacts also prints a 1 July 2025 estimate for the incorporated places in that set. Green is marked not applicable for that estimate.

Places under 5,000 are from the Census TIGERWeb incorporated-place table “2020 Census - Data as of January 1, 2020” (`tigerweb_acs26_incplace_2020_tab20_or.html`). Its `POP100` matches QuickFacts exactly for Roseburg (23,683), Sutherlin (8,524), Winston (5,625), Cottage Grove (10,574), and Creswell (5,641), so the same column is used for the smaller cities. Glide and the Green cross-check are from the Census TIGERWeb CDP table `tigerweb_acs25_cdp_2020_tab20_or.html` (Glide 1,805; Green 7,614).

Drive times are approximate. They are point-to-point driving routes from the Census 2020 Gazetteer internal point of Yoncalla (`43.600247, -123.292372`, file `2020_gaz_place_41.txt`) via the public OSRM server on 23 Oct 2026. No traffic. Not a Google Maps drive time.

| Place | County | 1 Apr 2020 | 1 Jul 2025 estimate | Minutes | Miles | Pop ÷ minutes |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Yoncalla | Douglas | 1,021 | — | — | — | home base |
| Drain | Douglas | 1,172 | — | 12.1 | 6.1 | 97 |
| Oakland | Douglas | 934 | — | 22.6 | 15.0 | 41 |
| Sutherlin | Douglas | 8,524 | 8,635 | 27.3 | 18.5 | 312 |
| Elkton | Douglas | 183 | — | 31.5 | 19.8 | 6 |
| Cottage Grove | Lane | 10,574 | 10,851 | 36.7 | 24.0 | 288 |
| Roseburg | Douglas | 23,683 | 23,693 | 39.6 | 29.7 | 598 |
| Creswell | Lane | 5,641 | 5,566 | 47.0 | 34.1 | 120 |
| Green CDP | Douglas | 7,614 | — | 47.9 | 35.9 | 159 |
| Winston | Douglas | 5,625 | 5,680 | 51.6 | 38.5 | 109 |
| Myrtle Creek | Douglas | 3,481 | — | 61.8 | 47.2 | 56 |
| Glide CDP | Douglas | 1,805 | — | 69.5 | 48.6 | 26 |
| Canyonville | Douglas | 1,640 | — | 69.6 | 55.6 | 24 |

Same method, for the service-area decision: Bend’s gazetteer point to Yoncalla is about 226 minutes and 171 miles. Yoncalla to Reedsport is about 86 minutes and 56 miles. Reedsport is why the profile and the schema should list towns, not “Douglas County” as a whole.

First landers, in that order: Roseburg, Sutherlin, Cottage Grove, Yoncalla, plus the county hub those old URLs will redirect to. Yoncalla is on the list because it is the NAP town, not because of the score.

Second: Winston, Creswell, Drain. Green is a CDP against Roseburg; mention it on the Roseburg page instead of a separate URL. Oakland is a short section on the Sutherlin page. Elkton is a sentence on the Yoncalla page.

Myrtle Creek, Glide, and Canyonville are past an hour on this routing. Leave them out of schema and out of the footer until Clancy says he will drive them.

Slugs, titles, descriptions, H1s, and keywords for the first wave are in `SITE-HANDOFF.md`.

## 4. Competitors actually found

No rank is claimed. Google’s HTML endpoint returned a JavaScript redirect shell with no organic results (the word “captcha” was not in that body). Bing’s result for “window replacement Roseburg Oregon” was Microsoft Windows, not local contractors. Yelp, Angi, Lowe’s, and Home Depot returned HTTP 403 to a direct fetch. DuckDuckGo’s HTML results and the company sites below were readable.

Seen on a page that names the business and the work:

| Name | Town on the page | URL | Where |
| --- | --- | --- | --- |
| Roseburg Glass Co | Roseburg; “greater Roseburg” and western Oregon since 1944 | https://www.roseburgglass.com/ | Own site, fetched. A review on the page mentions window replacements. Also a DuckDuckGo organic result. |
| Elite Restoration LLC | Roseburg office. CCB #218431 printed on the page. Links include Drain, Elkton, Canyonville; copy says Douglas County and parts of Lane and Coos. | https://www.eliteroseburg.com/door-and-window-installation | Fetched. H1 is door and window replacement in Roseburg. DuckDuckGo organic. |
| Windows by TNT / TNT Construction | Eugene, with a Roseburg service page. Phone on the page: 541-936-4586. | https://www.windowsbytnt.com/service-areas/window,-door,-&-siding-services-in-roseburg | Fetched. A web-search snippet of Angi for Sutherlin also named TNT Construction, LLC. The Angi site itself returned 403. |
| Firu Construction LLC | Cottage Grove page. CCB# 252438 in the meta description. Milgard and Ply Gem. | https://www.firuconstruction.com/windows-cottage-grove-oregon | Fetched. DuckDuckGo organic for Cottage Grove. |
| Willamette Craftworks | Cottage Grove page | https://willamettecraftworks.com/service/window-door-package/cottage-grove-or/ | Fetched. H1 “Window Replacement in Cottage Grove, OR”. DuckDuckGo organic. |
| Renewal by Andersen, southern Oregon page | Medford and Klamath Falls. Towns listed include Ashland, Central Point, Grants Pass, Cave Junction, Brookings, Gold Beach, Lakeview. Counties named: Jackson, Josephine, Klamath, Lake. | https://renewalbyandersenwest.com/service-area/oregon/southern-oregon/ | Fetched. Roseburg and Douglas County are not in that text. The nav lists Portland, Eugene, Bend, and Medford locations. |
| Renewal by Andersen ads | Roseburg and Sutherlin ad headlines | `renewalbyandersenpros.com` | DuckDuckGo ads, not organic results. A web-search retrieval of `/locations/or/roseburg/` showed a Roseburg landing page with a Portland address. That street is omitted here. Treat it as an ad page. |
| Lowe’s window installation | Roseburg store #1741 | https://www.lowes.com/store/1741-roseburg-or/window-installation | Direct fetch 403. A web-search retrieval of that URL returned a Roseburg window-installation page for store #1741. |

Not confirmed from a page I could read:

- Home Depot. DuckDuckGo returned `https://www.homedepot.com/services/l/or/roseburg/window-replacement/e57e696e1`. Direct fetches of that URL and the Roseburg store page failed.
- Renewal by Andersen’s Eugene service-area URL returned Cloudflare “Sorry, you have been blocked.” I could not see whether that office lists Douglas County.
- `https://www.renewalbyandersen.com/locations` fetched, but the static HTML did not include city names.
- Trueview Window Solutions LLC, Roseburg, license #263271, appears on `https://oregonrecordsfinder.com/roseburg/contractors/`, a third-party mirror. I did not open the Oregon CCB site or a company website for them.
- BBB’s search page loaded and said “619 results for window replacement near Roseburg, OR.” I did not get a clean list of window companies out of it. 619 is not a competitor count.

Doorway or lead-gen URLs on DuckDuckGo, fetched where noted, not treated as a local crew: Dominion Window (`/oregon/window-replacement-roseburg` fetched; “open 24 hours” template), Sure Windows (`/or/roseburg` fetched; generic template and an 855 number). Returned and not fetched: AP Window Co, LMR Windows, Abbott Glass and Door Repair, USA Door Repair, Cypress Door Repair, All Home Handyman, Today’s Homeowner, EcoWatch, areacosts, roseburgplugpros.

Oregon business-registry mirrors (opengovus and opencorpdata, seen via web search) list assumed business name PEAK VIEW WINDOWS AND DOORS, registry 256579195, registered 24 Apr 2026, in Bend, and Clancy LLC, registry 251510997, in Roseburg. Both pages publish a street. Those streets are not repeated here. The website does not publish them. They still matter for the Business Profile: the public registries and the website currently disagree about the town, and an address edit will be checked against them.

## 5. Google Business Profile

Sources fetched 23 Oct 2026:

- [Manage your service areas](https://support.google.com/business/answer/9157481) — up to 20 areas, by city, postal code, or other area, not a radius. Overall area should stay within about two hours of where the business is based. Hide the address if customers are not served there. Edits can take up to 48 hours. One profile for the area. A second profile for the same business in the same metro is a suspension risk.
- [Edit your Business Profile](https://support.google.com/business/answer/3039617) — “If you move your business to a new address after it’s verified, you must verify your business again.”
- [Mark your business as closed](https://support.google.com/business/answer/15300196) — closed more than 7 days, closed for the off-season, or closed indefinitely: use Temporarily closed. Special hours are for 7 days or less. For broad queries, temporarily closed businesses can rank after open ones. The profile still shows for a name search, marked closed.
- [Manage your business category](https://support.google.com/business/answer/7249669) — one primary, up to nine more, chosen from Google’s list. Google’s help page does not name the window categories. A third-party 2026 category list includes “Window installation service”, “Window supplier”, and “Door supplier”. Confirm the exact strings in the dashboard before saving. Do not type a category Google does not offer.

Recommended profile when it is reopened: service-area business, address hidden, primary category Window installation service, secondary Door supplier and Window supplier. No city and no “Bend” in the business name. Service areas, max 20, the ten towns in the schema block. Not “Douglas County” as a single area, because of Reedsport. Not a radius. Bend to Yoncalla is about 226 minutes on the route above, which is past Google’s two-hour guidance, so a Bend-based profile should not grow a Yoncalla service area while the underlying address stays in Bend.

This audit did not open the live Business Profile, so it does not say whether the current listing shows a street.

Path for this winter: mark the existing profile Temporarily closed. Do not change the address. Do not change the service area. Do not create a second profile. An address change requires re-verification, and nobody will be staffed to finish a video or postcard check during the pause. A failed check can take the listing down for the whole off-season. Special hours do not fit a winter shutdown. Temporarily closed is the off-season control Google documents.

Spring, in one week when someone can finish verification: hide the address, set the underlying address to the Yoncalla location, replace the service areas with the ten towns, set the categories, then set the profile back to open with real hours. Expect re-verification. Do it before ads are turned on and after the website already says Yoncalla.

The website will say Yoncalla as soon as it comes back, while the profile still says the old town and “temporarily closed.” That mismatch is intentional and temporary. The closed flag is what keeps the old pin from sending new jobs. Moving the pin in December is the higher risk.

Local Services Ads stay paused. Their service area is a separate setting. Update it to the same ten towns only after the profile has passed re-verification and the site matches, and only then consider re-enabling.

## 6. Two-day outage with the portal left up

Google’s guide, [Temporarily pause or disable a website](https://developers.google.com/search/docs/crawling-indexing/pause-online-business), fetched 23 Oct 2026:

- Prefer leaving the site up and limiting what it does (a banner, cart off).
- If the whole site must go dark, do it for a very short time, a few days at most.
- For one to two days, return `503` and `Retry-After`, with a short HTML explanation.
- `robots.txt` must stay `200`. A `503` on robots.txt blocks crawling.
- Do not `Disallow: /`. Do not use `404`, `410`, `403`, or `noindex` for the outage. Those drop URLs.
- Do not use the Search Console removals tool.
- The same guide lists lost Search Console access as a side effect of a site that actually falls out of the index. A one-to-two-day `503` that keeps the verification meta is the way to avoid that. The live homepage has a `google-site-verification` meta. The `503` body has to include that same tag.

A couple of days is the edge of what that guide calls safe. If the work slips, switch the homepage to `200` with a plain explanation and the portal link, instead of holding `503` for a week.

Keep the sitemap at `200` as well, so the URL list is still fetchable. Do not delete the property. Do not request indexing of the `503` responses.

The portal is a different host. The apex worker cannot serve it, and the `503` must not be copied onto `portal.peakvieworegon.com` or `quotes.peakvieworegon.com`. After the change, request both URLs and confirm the login still returns 401 with the login form. Add `noindex` on that login in its own project. It is missing today.

`/automations` can take the same `503` as the rest of the apex. It is already `noindex`.

## 7. Sequence

### A. Now, while the public site is off

Site code. In `worker.js`, `503` plus `Retry-After` for public GET/HEAD. Exempt `/robots.txt`, `/sitemap.xml`, and the verification meta (put it on the `503` page). Body: Yoncalla, phone, email, return date, portal link, installs paused. No Bend, no street. Do not touch the portal worker. Do not deploy the Yoncalla copy under a `200` until it is actually ready. Do not deploy from commit `c46d5a3` at all.

GBP, Chief of Staff. Temporarily closed. No address edit. No new profile. No service-area edit.

Search Console. Leave the property. Do not use removals. Do not submit the `503` for indexing.

Local Services Ads. Leave paused. Do not edit the area until spring.

Portal project, separate repo. `noindex` on the login, and change the visible town from Bend to Yoncalla when that repo is in hand. Not required for the apex `503` to go out, and not possible from this repository.

### B. When the site comes back (still winter, leads off)

Site code. Lift the `503` only when the Yoncalla copy is what will be served. Ship the handoff: rewritten core pages, schema, footer, first-wave landers, hub, 301s, sitemap, `blog/posts.json`, `/contract` set back to `noindex`. Quote form off or replaced with an existing-customer message. Banner: not scheduling new installs until spring. No “this week” and no “fast quote”.

Search Console. Submit the new sitemap. Inspect `/`, `/windows`, `/doors`, the county hub, Roseburg, and one old city URL to confirm the 301.

GBP. Still temporarily closed. Still the old service area. Do not “fix” the mismatch by moving the pin early.

Local Services Ads. Still paused.

### C. Spring relaunch

Site code. Remove the dormant banner. Restore the quote form and the opening hours in schema. Add Winston, Creswell, and Drain if the first wave is holding up. Still no street.

GBP, Chief of Staff. Hide the address, set Yoncalla as the underlying address, replace service areas with the ten towns, set categories, complete re-verification that week, then mark the profile open.

Search Console. Inspect the homepage again after the form returns.

Local Services Ads. Update the service area to those towns, confirm the site and the profile match, then re-enable. Not before.

## Sources

Live pages and portal hosts, curl, 23 Oct 2026. Census QuickFacts and TIGERWeb tables named in section 3. Census Gazetteer `2020_gaz_place_41.txt`. OSRM `router.project-osrm.org` the same day. Google Business Profile help and Google Search Central pause guide, URLs in sections 5 and 6. Competitor URLs in section 4. Raw per-page fields, counts, and JSON-LD summaries are in `crawl.json`.
