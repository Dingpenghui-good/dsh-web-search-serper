# dsh-web-search-serper

[English](README.md) | [中文](README.zh.md)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![DeepSeek Harness](https://img.shields.io/badge/DSH-Compatible-blue.svg)](https://github.com/deepseek-ai/deepseek-harness)

## Overview

`@dingpenghui/dsh-web-search-serper` is a web search provider plugin backed by the Serper.dev API, for the DeepSeek Harness (DSH) web capability seam (`ctx.web`, `@deepseek-ai/dsh-web` `0.2.0-rc.x`). It is built and verified against DSH **0.2.0-rc.2** and **0.2.1-rc.2**.

Serper.dev is an official Google Search partner providing fast, structured Google search results API. Free tier: **2,500 queries per month**, no credit card required.

### Features

- 🚀 **Fast Search** — 1-2 second response times using Google's real index
- 📊 **Structured Results** — JSON format, easy to parse
- 🔒 **Privacy Friendly** — No user tracking, no cookie collection
- 💰 **Generous Free Tier** — 2,500 monthly queries at no cost
- 🌍 **Multi-language Support** — Results from countries/regions worldwide
- 🔧 **Takes Over Out of the Box** — installing it as a bundle claims `web.searchProvider` automatically; key resolved lazily per search (config → env → credential store), no restart on change
- 🛟 **Automatic Fallback** — when Serper is unavailable it hands the request to another usable search provider instead of breaking `web_search` entirely
- ⚙️ **Settings Page on the Plugins Page** — the plugin's own page (opened from its name in the Plugins list, or from the row's configure control) edits the key, endpoint, `gl`/`cr` and default result count; saved values apply to the next search without a restart
- 🔁 **Hot Configuration** — every search re-reads the row config (including `volatile()`-wrapped values from `ctx.settings.describe()`), so credentials and options changed elsewhere are picked up immediately

---

## Quick Start

### Install

```bash
# Option 1 — install from npm (recommended)
dsh plugin --profile web add @dingpenghui/dsh-web-search-serper

# Option 2 — local bundle via link:
# 1. Add to the profile's package.json `dependencies`:
#    "@dingpenghui/dsh-web-search-serper": "link:<absolute path to this dir>"
# 2. Add "@dingpenghui/dsh-web-search-serper" to `dsh.profile.bundles`,
#    and add the insert row to cordis.patch.yml (or copy this package's
#    own cordis.patch.yml content)
pnpm install
pnpm run build
```

### Configure

**Installing as a bundle (recommended) needs no manual configuration.** The
package's own `cordis.patch.yml` is applied with the bundle and claims the web
seam's search provider for `serper`:

```yaml
- id: web
  name: '@deepseek-ai/dsh-web'
  config:
    searchProvider: serper     # overrides dsh-base's deepseek-official
    fetchProvider: http        # must be restated: a patch replaces the whole config
- insert:
    - id: web-search-serper
      name: '@dingpenghui/dsh-web-search-serper'
```

> **Why the takeover is required.** `dsh-base` pins `web.searchProvider` to
> `deepseek-official`, and the seam's selection rule is "a configured id is the
> only candidate — never a fallback on failure". Inserting the row without the
> takeover leaves the plugin registered but **never invoked, and silently so**.
> Your profile's own `cordis.patch.yml` is applied after the bundle layer and
> wins, so overriding `- id: web` there switches to another backend.

If you are not using the bundle mechanism and copy rows into your profile patch
by hand, copy **both** blocks above — otherwise it will not take effect either.

No `config` is required: the API key is resolved lazily per search in this order:

1. row `config.apiKey` (explicit, when you add a `config` block to the row — editable on the plugin detail page, hot-applied after save);
2. the `SERPER_API_KEY` environment variable of the DSH host process;
3. a `SERPER_API_KEY` reference in the DSH credential store
   (`$DSH_HOME/.credentials.yaml` `refs:` — resolved per search, no restart on change).

To pin the key and options in the composition instead:

```yaml
- id: web-search-serper
  name: '@dingpenghui/dsh-web-search-serper'
  config:
    apiKey: your-serper-api-key
    gl: cn  # Optional: set default country code
```

### Behavior: Serper first, automatic fallback

- **Preferred** — whenever Serper is ready (key present, endpoint valid) it is used;
- **Fallback** — if Serper fails for any reason (missing key, 401/403 auth
  failure, 429 rate limit, 5xx, network error, misconfigured endpoint, …), the
  request is handed to another registered and usable search provider on the
  seam, normally the `deepseek-official` provider shipped with `dsh-base`;
- **Not on cancel** — a user cancellation (`WEB_ABORTED`) never falls back;
- **Both down** — throws `WEB_PROVIDER_ERROR` whose message names both the
  primary and the fallback failure, with the fallback error on the `cause` chain.

The fallback lives **inside the plugin**, because the DSH web seam itself does
not fall back (a configured id is the only candidate). Accordingly,
`available()` still returns `true` when Serper is unusable but a fallback target
exists — otherwise the seam would reject the provider with
`WEB_PROVIDER_CONFIGURED_UNAVAILABLE` before `search()` ever ran, and no
fallback could happen.

### Settings page (Plugins page)

The client half registers the plugin's configuration page into the Plugins
page's `plugins.bundle.config` slot (keyed by the package name) and the
row-level `plugins.row.config` slot (keyed by
`@dingpenghui/dsh-web-search-serper#web-search-serper`). Both follow the Host's
served settings namespaces through `configForms.whileServed`, so the page
appears only while `web-search-serper` is served and disappears on its own
otherwise.

On `0.2.x` the two slots render differently: the bundle page passes no
`form`, so it shows a read-only overview that points at the row's configure
page; the row page passes the row's `form` (`state` + `mutate`), which is where
the settings are edited and saved (API key, endpoint base URL, `gl`, `cr`,
default result count) through the Host's settings form.

Because every search re-reads `ctx.settings.describe()`, a saved row config —
whose `volatile()` fields arrive as `{ get(): value }` wrappers, unwrapped the
same way the Host's own `plainConfig` does — applies to the next search without
restarting the Host.

### Troubleshooting: installed and configured, yet searches still bypass Serper

This is the easiest trap with this plugin, and it is not the plugin's fault — it
is about *when* DSH reads configuration.

**A profile's `cordis.patch.yml` is read exactly once, at DSH process startup.**
If you install the plugin, or repoint `web.searchProvider` to `serper`, while
DSH is already running, the current process will **not** reload the plugin
layer. The plugin sits in a "installed, configured, but not in effect" state,
and searches quietly keep using the built-in backend — **with no error at all**.

Diagnostic order (every step is logged as of v1.2.7):

1. **Restart DSH after any change.** This is the most common cause.
2. Look for this line in the Host log (proof the plugin layer loaded):
   ```
   web-search-serper: registered search provider "serper" (key source: credential)
   ```
   Missing → the plugin layer did not load; go back to step 1.
3. These warnings mean the plugin loaded but **will not be called**:
   ```
   web-search-serper: web.searchProvider is "deepseek-official", not "serper" —
   this plugin is loaded but will not be used until the web row selects it

   web-search-serper: the web row does not declare searchProvider —
   this plugin is registered but the seam will not route searches to it
   ```
   The first means the `web` row was not taken over (see "taking over search"
   above); the second means the setting is absent.
4. A fallback warning means Serper failed and another backend answered:
   ```
   web-search-serper: fell back to "deepseek-official" — serper failed: <reason>
   ```
   Typical causes: invalid or exhausted key (401/403), quota (429), no network.
5. Read the state programmatically (Host side):
   ```js
   import { readRuntimeStatus } from '@dingpenghui/dsh-web-search-serper'
   readRuntimeStatus()
   // { registered: true, calls: 12, serperHits: 12, fallbacks: 0,
   //   last: { outcome: 'serper-ok', servedBy: 'serper', keySource: 'credential', ... } }
   ```
   `registered: false` or `calls: 0` map to the issues in steps 2 and 3.
   The snapshot **never contains the key itself**, only `keySource`
   (`config` / `env` / `credential` / `missing`), so you can tell "I thought I
   configured a key" apart from what was actually resolved.

> One line: **after installing or changing configuration, restart DSH — then
> confirm it is alive via the `registered search provider` log line.**

### Compatibility

| DSH runtime | Plugin version |
|-------------|----------------|
| `0.2.x` (verified on `0.2.0-rc.2` and `0.2.1-rc.2`) | `1.2.3` |
| `0.1.7-rc.x` | `1.2.0` |

Since `1.2.3`, the DSH compatibility range is expressed **solely** by
`engines.dsh` (`>=0.2.0-rc.2 <0.3.0-0`), and `@deepseek-ai/dsh-web` /
`@deepseek-ai/dsh-llm` are **not** listed in `peerDependencies`. See below.

**Why `1.1.1` refuses to install:** without `engines.dsh`, DSH's install gate
(`evaluatePluginCompatibility` in `dsh-app-boot`) inspects every
`@deepseek-ai/dsh-*` entry of `peerDependencies` and evaluates it with
`semver.satisfies(runtime, range, { includePrerelease: true })`. `1.1.1` pinned
`@deepseek-ai/dsh-web` to the exact version `0.2.0-rc.2`, and under that rule
`0.2.1-rc.2` does **not** satisfy `0.2.0-rc.2`, so the install is rejected:

```
Plugin @dingpenghui/dsh-web-search-serper@1.1.1 is incompatible with dsh 0.2.1-rc.2:
requirements {"@deepseek-ai/dsh-web":"0.2.0-rc.2"}
```

`1.2.3` lets `engines.dsh` decide alone (when present, the host looks at it and
ignores peers) and drops the peer declarations for host-provided DSH runtime
packages, which a plugin must not vendor a second copy of. `smoke-test.mjs`
gained a regression guard that calls the host's own
`evaluatePluginCompatibility` when available (falling back to an equivalent
local implementation), so the manifest must stay installable on `0.2.0-rc.2`
and `0.2.1-rc.2` and rejected on `0.3.0` / `0.1.5`.

The slot/page surface is unchanged from `1.2.2`: `plugins.bundle.config`
receives only `view: 'page'` (no `form`, so it renders a read-only overview),
while `plugins.row.config` receives the row's `form` (`state` + `mutate`) and is
the editable view; both follow `configForms.whileServed`.

> The `0.2.1-rc.2` client platform packages do ship `.d.ts`; the plugin still
> declares the surface it consumes in `src/contracts.d.ts` and
> `src/client/*.d.ts` to keep types stable across runtime lines.

### Get API Key

1. Visit [https://serper.dev](https://serper.dev)
2. Register for a free account
3. Get your API Key from the Dashboard
4. Free tier: 2,500 queries per month

---

## Configuration Options

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `apiKey` | string | No | `$SERPER_API_KEY`, then credential reference `SERPER_API_KEY` | Serper API key (secret, volatile) |
| `baseURL` | string | No | `https://google.serper.dev` | API endpoint base |
| `gl` | string | No | - | Country code (e.g., `us`, `cn`, `jp`) |
| `cr` | string | No | - | Region code (e.g., `us`; sent as the `cr` parameter) |
| `numResults` | number | No | omitted (Serper defaults to 10) | Default result count, capped at 100 |

---

## Usage Examples

### Basic Search

```typescript
import { apply } from '@dingpenghui/dsh-web-search-serper'

// Used by the Cordis loader; no direct calls needed in most deployments.
// In a Cordis plugin:
// apply(ctx)
```

### Search via ctx.web

```typescript
const result = await ctx.web.search({
  query: 'latest AI developments 2026',
  maxResults: 5,
})

console.log(result.sources)
// [
//   { url: '...', title: '...', snippet: '...' },
//   ...
// ]
```

---

## Error Handling

| Error Code | Meaning | Resolution |
|------------|---------|------------|
| `WEB_PROVIDER_CONFIGURED_MISSING` | Configured provider not registered | Check if plugin is loaded correctly |
| `WEB_PROVIDER_CONFIGURED_UNAVAILABLE` | Provider registered but no key available | Check API key: config / `$SERPER_API_KEY` / credential reference |
| `WEB_ABORTED` | Request was aborted | Check AbortSignal |
| `WEB_PROVIDER_ERROR` | API request failed | Check network / API key / rate limits |

> `WEB_PROVIDER_CONFIGURED_UNAVAILABLE` and `WEB_PROVIDER_ERROR` only reach
> `web_search` when the **fallback target is unusable too**; a Serper-only
> failure is absorbed by the automatic fallback (see "Behavior" above).

---

## Limitations & Known Issues

1. **Free tier limit** — 2,500 monthly queries, paid plans for higher usage
2. **Google Search only** — Does not support Bing, Baidu, or other search engines
3. **No generated answers** — Returns search results only, no AI-generated summaries
4. **API Key required** — Must provide a valid Serper API Key via config, environment, or credential reference
5. **One DSH line at a time** — `1.2.3` supports DSH `0.2.x` (`>=0.2.0-rc.2 <0.3.0-0`); a different runtime line needs the matching plugin version (see "Compatibility")

---

## Related Projects

- [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) — DSH main project
- [Serper.dev](https://serper.dev) — Google Search API service

---

## License

MIT License — See [LICENSE](LICENSE) file


Support any Serper.dev-compatible endpoint (like litescrape.com, serpbase.dev, serpensapi.org, and others). Set `baseURL` to the provider base URL (without `/search`) and configure an API key issued by that provider. The `/search` path is appended automatically.
