# Public website restoration

The brief is to **retain the existing website appearance**, not modernize it. The recruitment app remains the new backend; the public website restores the legacy Vue/Vuetify site's branding, information architecture, content and visual treatment in Next.js.

## Reference and recovered material

- Live reference: https://www.kenyabaristaorg.or.ke/ (inspected 16 October 2026).
- Primary layout/content reference: the owner's downloaded `../js/*.js.map` files. Their `sourcesContent` entries contain original Vue templates, page text, data arrays and scoped CSS. This is more complete than the initially visible compiled HTML.
- Original logo and value images: `../img`; the Feedback illustration was recovered from its embedded PNG in the philosophy source map.
- The existing coffee hero, plantation guide hero, footer texture, course posters, team photos, gallery and product images were copied from their original URLs into `public/legacy`. No stock/generated replacement artwork was introduced.
- Original Roboto Condensed (300), Indie Flower, Syne Mono and Xanh Mono typography is hosted locally. Font license files are in `public/legacy/font-licenses`.

The original downloaded archive remains unchanged. The restored content is tracked in `src/content/legacy-site.json` and `src/content/legacy-guides.json`; runtime does not depend on access to the old site or source maps. Only reviewed, static archive-derived HTML is rendered in the guide component. No user-provided or remote HTML is inserted into it.

## Restored routes and appearance

| Route | Restored content |
| --- | --- |
| `/` | Coffee background and logo/tagline, three original information panels, coffee quote, staggered purpose/mission/vision sections |
| `/philosophy` | Organisation history, board roles and all ten original core values/illustrations |
| `/team` | All seven original team entries and photos, with the lead above paired members |
| `/gallery` | All 33 gallery photos, photo viewer, original 31-item product strip and Coming Soon text |
| `/registration` | Original course posters/location, course enquiry form and link to separate job registration |
| `/contact` | Contact details, social links, original contact illustration and email enquiry form |
| `/farming` | Original farming content, varieties and coffee-grade table |
| `/comparison` | Original Arabica/Robusta tabs, article and comparison table |
| `/bean` | Original bean-to-cup process, brewing tabs and expandable steps |
| `/drinks` | Original coffee drink guide, illustrations and descriptions |

The brown navigation, original wordmark, green accents, white flat public sections, hero sizing, handwritten taglines, footer texture and responsive menu have been retained. Jobs and My account are added to navigation/footer. Existing job pages use this public shell. The new account/admin/recruitment workflows remain operational and are outside the legacy public-content layout.

The mobile menu supports keyboard use/Escape; guide tabs support arrow/Home/End navigation; brewing steps use native details; gallery viewing uses a native modal dialog with Escape, next/previous controls and focus return. No browser automation was available to visually or interactively verify these behaviours. Code and HTTP checks do not certify pixel-for-pixel parity.

## Enquiry and registration boundaries

The recovered contact and course-registration templates had no working submission handlers. The restored forms prepare a `mailto:` draft using the original public address, with an explicit message that the visitor must send it through their email app. They do not pretend to submit to a server, save course enrolments, send external mail automatically, or collect identity-document numbers. Online course enrolment processing is not part of the recruitment application scope. `/registration` is the original course route; `/register` remains job-applicant account registration.

The source phone, email, physical location, course posters, board names/roles and social profiles were retained as archived content. In particular the source email ends in **kenyabaristaorg.co.ke**, while the website domain ends in **kenyabaristaorg.or.ke**. The client should verify these archived details and poster information before launch; they were not silently rewritten or represented as newly verified information.

## Two missing illustrations

All gallery and team images were recovered. Two external illustrations on the original farming page remain unavailable after retries:

- SL-28 illustration from `images.nidux.net`: the original URL returns HTTP 530.
- SL-34 illustration at `https://varieties.worldcoffeeresearch.org/content/5-varieties/0-sl28/sl28-kenya-2.jpg`: HTTP 404.

Their descriptions remain intact, with explicit missing-image placeholders. Original copies are needed to complete these two image slots faithfully. No replacement image was invented.

## Validation and remaining acceptance

HTTP checks passed for all ten original public routes, expected content, restored navigation, seven team members, ten values, 33 gallery slots, 31 product entries, guide tables and static HTML checks. All **99 referenced local image/font assets** checked successfully (95 image assets and four fonts). Job filter validation and the separate applicant-registration route remain available. These checks used a separate local preview on port 3109; no original-site changes, DNS changes, external messages, database migrations or VPS deployment occurred.

Desktop/mobile visual comparison, hover/menu/tab/lightbox interaction acceptance, email-client draft opening and client confirmation of archived details remain before launch. The existing no-index staging setting is retained. Production service acceptance, monitoring, backup/restore and VPS/domain cutover remain the deployment phase.
