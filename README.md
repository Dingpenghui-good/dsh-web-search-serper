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
- 🔧 **One-line Insert** — a single row in your profile `cordis.patch.yml`; key resolved lazily per search (config → env → credential store), no restart on change

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

Add to your DSH `cordis.patch.yml` (profile patch layer):

```yaml
- insert:
    - id: web-search-serper
      name: '@dingpenghui/dsh-web-search-serper'
```

No `config` is required: the API key is resolved lazily per search in this order:

1. row `config.apiKey` (explicit, when you add a `config` block to the row — editable on the plugin detail page, hot-applied after save);
2. the `SERPER_API_KEY` environment variable of the DSH host process;
3. a `SERPER_API_KEY` reference in the DSH credential store
   (`$DSH_HOME/.credentials.yaml` `refs:` — resolved per search, no restart on change).

To pin the key and options in the composition instead:

```yaml
- insert:
    - id: web-search-serper
      name: '@dingpenghui/dsh-web-search-serper'
      config:
        apiKey: your-serper-api-key
        gl: cn  # Optional: set default country code
```

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
