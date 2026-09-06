# @dingpenghui/dsh-web-search-serper

[English](README.md) | [中文](README.zh.md)

[![npm version](https://img.shields.io/npm/v/@dingpenghui/dsh-web-search-serper.svg)](https://www.npmjs.com/package/@dingpenghui/dsh-web-search-serper)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![DeepSeek Harness](https://img.shields.io/badge/DSH-Compatible-blue.svg)](https://github.com/deepseek-ai/deepseek-harness)

## Overview

`@dingpenghui/dsh-web-search-serper` is a web search provider plugin backed by the Serper.dev API, designed for the DeepSeek Harness (DSH) web capability seam (`ctx.web`).

Serper.dev is an official Google Search partner providing fast, structured Google search results API. Free tier: **2,500 queries per month**, no credit card required.

### Features

- 🚀 **Fast Search** — 1-2 second response times using Google's real index
- 📊 **Structured Results** — JSON format, easy to parse
- 🔒 **Privacy Friendly** — No user tracking, no cookie collection
- 💰 **Generous Free Tier** — 2,500 monthly queries at no cost
- 🌍 **Multi-language Support** — Results from countries/regions worldwide
- 🔧 **Zero-config Integration** — One line to connect with DSH

---

## Quick Start

### Install

```bash
pnpm add @dingpenghui/dsh-web-search-serper
# or
npm install @dingpenghui/dsh-web-search-serper
```

### Configure

Add to your DSH `cordis.patch.yml`:

```yaml
- id: web
  config:
    searchProvider: serper

- insert:
    - id: web-search-serper
      name: '@dingpenghui/dsh-web-search-serper'
      config:
        apiKey: your-serper-api-key
        gl: cn  # Optional: set default country code
```

Or via environment variable:

```yaml
- id: web-search-serper
  name: '@dingpenghui/dsh-web-search-serper'
  config:
    apiKey: !!js process.env.SERPER_API_KEY
```

Then set the environment variable:

```bash
export SERPER_API_KEY=your-api-key-here
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
| `apiKey` | string | No | `$SERPER_API_KEY` | Serper API key |
| `baseURL` | string | No | `https://google.serper.dev` | API endpoint base |
| `gl` | string | No | - | Country code (e.g., `us`, `cn`, `jp`) |
| `cr` | string | No | - | Region code (e.g., `cr=us`) |
| `numResults` | number | No | 10 | Default result count |

---

## Usage Examples

### Basic Search

```typescript
import { apply } from '@dingpenghui/dsh-web-search-serper'

// Use in a Cordis plugin
apply(ctx, {
  apiKey: 'your-api-key',
  gl: 'cn',
})
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
| `WEB_PROVIDER_CONFIGURED_UNAVAILABLE` | Provider registered but unavailable | Check if API Key is valid |
| `WEB_ABORTED` | Request was aborted | Check AbortSignal |
| `WEB_PROVIDER_ERROR` | API request failed | Check network/API Key/rate limits |

---

## Limitations & Known Issues

1. **Free tier limit** — 2,500 monthly queries, paid plans for higher usage
2. **Google Search only** — Does not support Bing, Baidu, or other search engines
3. **No generated answers** — Returns search results only, no AI-generated summaries
4. **API Key required** — Must provide a valid Serper API Key in configuration

---

## Related Projects

- [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) — DSH main project
- [Serper.dev](https://serper.dev) — Google Search API service
- [@dsh-web-search-exa](https://www.npmjs.com/package/@dsh-web-search-exa) — Exa search provider
- [@dsh-web-search-perplexity](https://www.npmjs.com/package/@dsh-web-search-perplexity) — Perplexity search provider

---

## License

MIT License — See [LICENSE](LICENSE) file

---

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## Support

For issues and questions:
- Submit a [GitHub Issue](https://github.com/dingpenghui-good/dsh-web-search-serper/issues)
- Check the [Documentation](https://github.com/dingpenghui-good/dsh-web-search-serper#readme)
