# Architecture Review: Patreon Content Fetch via YouTube Links

**Date:** 2026-09-17
**Status:** Proposed
**Supersedes guidance in:** `docs/plans/2026-01-14-patreon-hybrid-architecture.md` (discovery layer only)

## Summary

The January ADR's core premise still holds in September 2026: Patreon's v2 API
does not expose post content or attachments to a *patron* — only to the account
that authored them. Cookie-based download via `patreon-dl` remains the only way
to reach content the user already pays for. That decision does not need revisiting.

What does need revisiting is the **shape** of the pipeline built on top of it.
The current design is a live, per-query fan-out across two remote APIs plus a
subprocess. It should be an offline ingest that builds a local index, plus a
local query. Nearly every performance, quota, and reliability problem in
`docs/Patreon_Investigation.md` is downstream of that one inversion.

## Part 1 — The discovery layer is inverted

### What happens now

`PatreonSource.searchPatternsInternal` (`src/sources/premium/patreon.ts:196`)
runs, per user query:

1. **Global-first** (`patreon.ts:257`): up to 2 `search.list` calls against *all
   of YouTube*, 30 results each, then `addVideosForKnownCreators`
   (`patreon.ts:247`) discards everything not on one of 2 selected channels.
2. **Sparse fallback** (`patreon.ts:275`): if fewer than 4 survived, up to 1 more
   channel-scoped `search.list`.
3. Each search triggers a `videos.list` hydration (`youtube.ts:139`).

### Why this is the wrong shape

**Quota.** `search.list` costs 100 units; the default project quota is 10,000/day.
A deep query costs ~300 units, so the tool supports roughly **33 queries per day**
before hard failure. There is no quota accounting anywhere in the codebase.

**The global-first strategy pays full price for mostly-discarded results.** It
spends 100 units asking Google to rank across ~all of YouTube, then throws away
every result that isn't from a corpus of three channels. For a narrow query, the
hit rate is often zero — and the fallback then spends another 100 units doing the
scoped search that should have been the first and only call.

**Ranking is outsourced to the wrong engine.** The target corpus is a few hundred
videos from three creators. YouTube's relevance ranking is tuned for a corpus of
billions and is neither deterministic nor tunable. The project already depends on
`minisearch` and has a well-developed local scorer (`patreon-scoring.ts`,
`query-analysis.ts`) that is strictly better suited — but it currently only gets
to re-rank whatever YouTube already decided to hand back.

**Seven env knobs exist to ration a quota you shouldn't be spending.**
`PATREON_YOUTUBE_MAX_CREATORS`, `_MAX_VARIANTS`, `_GLOBAL_MAX_RESULTS`,
`_MIN_MATCHES_BEFORE_FALLBACK`, `_FALLBACK_MAX_CREATORS`, `_FALLBACK_MAX_VARIANTS`,
`_SEARCH_CALL_BUDGET` (`patreon.ts:48-56`) are all budget heuristics. They are
accidental complexity created by the live-search design.

### Recommendation: crawl once, search locally

Replace per-query `search.list` with a periodic catalog crawl:

| Step | Endpoint | Cost |
|---|---|---|
| Resolve uploads playlist | `channels.list(part=contentDetails)` | 1 unit, once per creator |
| Page the back catalog | `playlistItems.list` (50/page) | 1 unit per 50 videos |
| Hydrate full descriptions | `videos.list(part=snippet)` (50/call) | 1 unit per 50 videos |

The **entire back catalog of all three creators costs roughly 20–40 units**, once.
A daily incremental refresh costs single-digit units. Compare to ~300 units per
user query today — a ~4 order-of-magnitude reduction in steady-state quota.

Then serve queries entirely from the local index via the existing scoring code.

Consequences:
- Query-time YouTube latency: **~900ms → ~0**.
- Coverage becomes complete and deterministic instead of "whatever search returned".
- The seven budget knobs and both search strategies delete.
- `YOUTUBE_API_KEY` can become optional: `https://www.youtube.com/feeds/videos.xml?channel_id=<id>`
  needs no key and no quota. It returns only the 15 most recent videos with
  truncated descriptions, so it is a good *incremental refresh* path but not a
  backfill path. Offering it means the tool degrades to "recent content only"
  without an API key rather than failing closed (`getPatreonPatterns.ts:12`
  currently hard-blocks on a missing key).

## Part 2 — YouTube shouldn't be the gate at all

The deeper issue: **YouTube is being used as an index for Patreon, but Patreon
can be indexed directly.**

Enrichment only fires for patterns whose URL matches `patreon.com/posts/`
(`patreon.ts:319`). But most creators put a *campaign* link
(`patreon.com/kavsoft`) in their video descriptions, not a per-post link. For
those videos — likely the majority — nothing is ever downloaded, and the returned
"Patreon pattern" is really just a YouTube description with a Patreon-shaped URL
on it. The tool's headline capability quietly no-ops on most of its inputs.

`patreon-dl` can enumerate a creator's posts directly (by user/campaign, not just
by single post URL). That inverts the dependency correctly:

```
Patreon campaign (content of record)  ──► posts + attachments + Swift files
        ▲                                          │
        │ which campaigns?                         ▼
  OAuth identity.memberships                  local index
        │                                          ▲
        └── YouTube (optional metadata) ───────────┘
                 match by title/date, not by link presence
```

Two wins fall out:

1. **No dependency on creators linking posts in descriptions.** Title/date
   similarity matching between a campaign's posts and a channel's videos is far
   more robust than requiring a `posts/` URL to appear in free text.
2. **The hardcoded creator registry goes away.** `CREATORS`
   (`src/config/creators.ts:11`) pins the tool to exactly three creators. But
   `getSubscribedCreators()` (`patreon.ts:99`) already returns the user's *actual*
   active patron memberships from the OAuth identity endpoint. That is the
   authoritative list and it is currently computed and then ignored by the search
   path. Feed it into ingest and the tool works for whoever the user actually
   supports, with the YouTube channel ID as optional per-creator config.

This also fixes a latent correctness issue: `searchPatterns` never verifies
membership, despite the ADR claiming OAuth "prevents wasted requests". Today
OAuth gates nothing.

## Part 3 — Downloading on the read path

`mode: 'deep'` (the default for `get_patreon_patterns`, `getPatreonPatterns.ts:47`)
can trigger up to 5 post downloads inside a single tool call, each with a **120s
subprocess timeout** (`patreon-dl.ts:161`). Worst case that is minutes of blocking
inside an MCP request. Most MCP clients will have given up long before.

Move download and parse to an ingest job — a `swift-patterns-mcp sync` command
plus an optional background refresh timer. The query path then only reads the
local index. The `fast`/`deep` mode split becomes unnecessary, and so does the
`PATREON_DIRECT_URL_TIMEOUT_MS` race in `searchDirectPostUrl` (`patreon.ts:175`).

## Part 4 — Replace `npx` with the library

`downloadPost` shells out to `npx --yes patreon-dl@3.6.0` per post
(`patreon-dl.ts:160-161`). `patreon-dl` ships a **programmatic Node API** — it is
documented as "both the patreon-dl library and its command-line tool." Four
problems disappear by importing it:

1. **Session cookie is passed in argv** (`-c session_id=${cookie}`). Process
   arguments are readable by any local process via `ps` / `/proc/<pid>/cmdline`.
   A live Patreon session token should never be an argv. The library API takes it
   as a value in-process.
2. **The package is not in `package.json`.** `--yes` resolves and installs
   `patreon-dl@3.6.0` from the network at runtime, outside the lockfile the rest
   of the project maintains carefully. That is an unpinned supply-chain surface
   and it means downloads fail offline even when everything else is cached.
3. **Process spawn per post.** Even on a warm npx cache this is hundreds of ms of
   pure overhead before any work starts.
4. **Errors are stringified subprocess failures** (`patreon-dl.ts:172`). The
   library surfaces typed errors, which is what's needed to distinguish "cookie
   expired" (actionable: re-auth) from "post not in your tier" (actionable:
   nothing) from "network". Right now both collapse into a silent empty result.

### Related: cookie storage location

`getCookiePath()` returns `process.cwd()/.patreon-session` (`patreon-dl.ts:58-60`)
while every other piece of state lives under `~/.swift-patterns-mcp/`
(`src/utils/paths.ts`). An MCP server's cwd is whatever directory the client
launched it from, so authentication appears to vanish depending on where the
editor was opened — and worse, it can write a live session token into whatever
git repo the user happens to be in. Move it to `getSwiftMcpDir()` with `0600`
permissions.

## Part 5 — The filesystem is being used as a database

`scanDownloadedContent()` (`patreon-dl.ts:210`) walks the whole content tree,
reads and parses **every** `.swift` and `.md` file, and **re-extracts every zip
into memory** (`extractZipContents`, `patreon-dl.ts:365`), behind a 30-second TTL
cache. Every 30 seconds, all archives are decompressed again. Cost grows linearly
with the user's library and never plateaus. The full text of every downloaded
file is held resident in the cached `DownloadedPost[]`, and `getDownloadedPatterns`
(`patreon-enrichment.ts:175`) re-derives patterns from all of it on every query.

Replace with an ingest-time index: SQLite, or a JSON manifest keyed by
`postId → {mtime, files[], metadata}`. Content stays on disk and is read on
demand; only metadata and the search index stay in memory. `isPostDownloaded`
(`patreon-dl.ts:113`) becomes an O(1) lookup instead of a full tree walk, and
re-ingest becomes incremental via mtime comparison.

## Part 6 — Smaller findings

- **keytar failure is silent** (`patreon-oauth.ts:71-80`). On Linux without
  libsecret, `saveTokens` returns successfully having discarded the token. The
  user re-authenticates forever with no error message. Either surface the failure
  or fall back to an explicit `0600` file with a warning.
- **Unused OAuth scopes.** `campaigns` and `campaigns.members`
  (`patreon-oauth.ts:32-35`) are creator-only and unused by any code path. They
  inflate the consent screen for no benefit. Request `identity` and
  `identity.memberships` only.
- **Patreon API v1 sunsets 2026-10-07.** The code already uses v2 exclusively
  (`PATREON_API`, `patreon.ts:29`) — no action needed, noted for completeness.
- **Content stays local.** Worth stating explicitly as an invariant in the ADR:
  downloaded patron content is indexed for the paying user's own machine and is
  never re-served, uploaded, or redistributed. The ingest design above doesn't
  change that, but it makes the cache larger and longer-lived, so the boundary is
  worth writing down.

## Suggested order

Sequenced by value-per-unit-of-risk:

| # | Change | Effect |
|---|---|---|
| 1 | Catalog crawl (`playlistItems.list`) replaces per-query `search.list` | ~300 → ~0 units/query; ~900ms → ~0 latency; deletes 7 knobs |
| 2 | Import `patreon-dl` as a library; pin in `package.json` | Removes cookie-in-argv, runtime install, spawn cost; typed errors |
| 3 | Move cookie to `~/.swift-patterns-mcp/`, mode `0600` | Fixes auth-vanishes-by-cwd and token-in-repo |
| 4 | Move download/parse into a `sync` ingest job | Query path stops blocking on multi-minute work |
| 5 | Persistent index replaces repeated tree walk + zip re-extraction | Bounded memory, incremental updates, O(1) lookups |
| 6 | Drive creator list from OAuth memberships; match posts↔videos by title/date | Removes 3-creator ceiling and the `posts/`-link dependency |
| 7 | Error surfacing: cookie expiry, quota exhaustion, keytar unavailable | Users stop seeing "no results" for fixable auth failures |

Steps 1–3 are independent and individually shippable. Step 6 is the largest
change and depends on 4 and 5 being in place.

## References

- [Patreon API docs](https://docs.patreon.com/)
- [Still no valid path to /posts content for subscribers? — Patreon Developers](https://www.patreondevelopers.com/t/still-no-valid-path-to-posts-content-for-subscribers/11445)
- [YouTube Data API — determine quota cost](https://developers.google.com/youtube/v3/determine_quota_cost)
- [YouTube Data API — PlaylistItems: list](https://developers.google.com/youtube/v3/docs/playlistItems/list)
- [patreon-dl (library + CLI)](https://github.com/patrickkfkan/patreon-dl)
