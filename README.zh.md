# dsh-web-search-serper

[English](README.md) | 中文

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![DeepSeek Harness](https://img.shields.io/badge/DSH-Compatible-blue.svg)](https://github.com/deepseek-ai/deepseek-harness)

## 概述

`dsh-web-search-serper` 是一个基于 Serper.dev API 的 Web 搜索提供方插件，适配当前 DeepSeek Harness (DSH) 的 web 能力 seam（`ctx.web`，`@deepseek-ai/dsh-web` `0.2.0-rc.x`）。

Serper.dev 是 Google 搜索的官方合作伙伴，提供高速、结构化的 Google 搜索结果 API。免费额度：**每月 2,500 次查询**，无需信用卡。

### 特性

- 🚀 **高速搜索** — 1-2 秒响应，基于 Google 真实索引
- 📊 **结构化结果** — JSON 格式返回，易于解析
- 🔒 **隐私友好** — 不追踪用户，无 Cookie 收集
- 💰 **免费额度高** — 每月 2,500 次查询，免费使用
- 🌍 **多语言支持** — 支持全球多个国家/地区的搜索结果
- 🔧 **一行 insert** — profile `cordis.patch.yml` 里一行接入；key 每次搜索惰性解析（config → 环境变量 → 凭证库），改动无需重启

---

## 快速开始

### 安装

```bash
# 作为 profile bundle 装入（推荐）：
# 1. 在 profile 的 package.json `dependencies` 加：
#    "dsh-web-search-serper": "link:<本目录绝对路径>"
# 2. 同步 `dsh.profile.bundles` 加 "dsh-web-search-serper"
#    并让 pnpm 把本包自带的 cordis.patch.yml 作为 bundle patch 应用
#    （也可以直接把 insert 行手动加到 profile 的 cordis.patch.yml）
pnpm install
pnpm run build
```

### 配置

在 DSH 的 `cordis.patch.yml`（profile 补丁层）中添加：

```yaml
- insert:
    - id: web-search-serper
      name: 'dsh-web-search-serper'
```

无需 `config` 即可工作：API key 在每次搜索时按以下顺序惰性解析：

1. 行 `config.apiKey`（显式配置，需给行加 `config` 块；插件详情页保存后经 volatile HMR 即时生效）；
2. DSH 宿主进程的环境变量 `SERPER_API_KEY`；
3. DSH 凭证库中的 `SERPER_API_KEY` 引用
   （`$DSH_HOME/.credentials.yaml` 的 `refs:` —— 每次搜索实时解析，改动无需重启）。

也可以在 composition 中固定 key 与选项：

```yaml
- insert:
    - id: web-search-serper
      name: 'dsh-web-search-serper'
      config:
        apiKey: your-serper-api-key
        gl: cn  # 可选：设置默认国家代码
```

### 获取 API Key

1. 访问 [https://serper.dev](https://serper.dev)
2. 注册免费账户
3. 在 Dashboard 获取 API Key
4. 免费额度：每月 2,500 次查询

---

## 配置选项

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `apiKey` | string | 否 | `$SERPER_API_KEY`，再回退到凭证引用 `SERPER_API_KEY` | Serper API 密钥（secret，volatile） |
| `baseURL` | string | 否 | `https://google.serper.dev` | API 端点基址 |
| `gl` | string | 否 | - | 国家代码（如 `us`, `cn`, `jp`） |
| `cr` | string | 否 | - | 地区代码（如 `us`，作为 `cr` 参数发送） |
| `numResults` | number | 否 | 省略（Serper 默认 10） | 默认结果数量，上限 100 |

---

## 使用示例

### 基础搜索

```typescript
import { apply } from 'dsh-web-search-serper'

// 由 Cordis loader 调用；大多数部署无需直接调用。
// apply(ctx)
```

### 通过 ctx.web 搜索

```typescript
const result = await ctx.web.search({
  query: '2026年AI发展趋势',
  maxResults: 5,
})

console.log(result.sources)
// [
//   { url: '...', title: '...', snippet: '...' },
//   ...
// ]
```

---

## 错误处理

| 错误码 | 含义 | 处理方式 |
|--------|------|----------|
| `WEB_PROVIDER_CONFIGURED_MISSING` | 配置的 provider 未注册 | 检查插件是否正确加载 |
| `WEB_PROVIDER_CONFIGURED_UNAVAILABLE` | provider 已注册但没有可用 key | 检查 API Key：config / `$SERPER_API_KEY` / 凭证引用 |
| `WEB_ABORTED` | 请求被中止 | 检查 AbortSignal |
| `WEB_PROVIDER_ERROR` | API 请求失败 | 检查网络 / API Key / 速率限制 |

---

## 限制与已知问题

1. **免费额度限制** — 每月 2,500 次查询，超出后需付费
2. **仅支持 Google 搜索** — 不支持 Bing、Baidu 等其他搜索引擎
3. **无生成答案** — 仅返回搜索结果列表，不包含 AI 生成的摘要
4. **需要 API Key** — 必须通过配置、环境变量或凭证引用提供有效的 Serper API Key

---

## 相关项目

- [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) — DSH 主项目
- [Serper.dev](https://serper.dev) — Google Search API 服务

---

## 许可证

MIT License — 见 [LICENSE](LICENSE) 文件
