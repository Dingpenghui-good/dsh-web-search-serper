# dsh-web-search-serper

[English](README.md) | [中文](README.zh.md)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![DeepSeek Harness](https://img.shields.io/badge/DSH-Compatible-blue.svg)](https://github.com/deepseek-ai/deepseek-harness)

## Overview

`@dingpenghui/dsh-web-search-serper` is a web search provider plugin backed by the Serper.dev API, for the current DeepSeek Harness (DSH) web capability seam (`ctx.web`, `@deepseek-ai/dsh-web` `0.2.0-rc.x`).

Serper.dev is an official Google Search partner providing fast, structured Google search results API. Free tier: **2,500 queries per month**, no credit card required.

### Features

- 🚀 **Fast Search** — 1-2 second response times using Google's real index
- 📊 **Structured Results** — JSON format, easy to parse
- 🔒 **Privacy Friendly** — No user tracking, no cookie collection
- 💰 **Generous Free Tier** — 2,500 monthly queries at no cost
- 🌍 **Multi-language Support** — Results from countries/regions worldwide
- 🔧 **Takes Over Out of the Box** — installing it as a bundle claims `web.searchProvider` automatically; key resolved lazily per search (config → env → credential store), no restart on change
- 🛟 **Automatic Fallback** — when Serper is unavailable it hands the request to another usable search provider instead of breaking `web_search` entirely

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

---

## Related Projects

- [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) — DSH main project
- [Serper.dev](https://serper.dev) — Google Search API service

---

## License

MIT License — See [LICENSE](LICENSE) file
