# @dsh-web-search-serper

[English](README.md) | 中文

## 概述

`@dsh-web-search-serper` 是一个基于 Serper.dev API 的 Web 搜索提供方插件，专为 DeepSeek Harness (DSH) 的 web 能力 seam (`ctx.web`) 设计。

Serper.dev 是 Google 搜索的官方合作伙伴，提供高速、结构化的 Google 搜索结果 API。免费额度：**每月 2,500 次查询**，无需信用卡。

### 特性

- 🚀 **高速搜索** — 1-2 秒响应，基于 Google 真实索引
- 📊 **结构化结果** — JSON 格式返回，易于解析
- 🔒 **隐私友好** — 不追踪用户，无 Cookie 收集
- 💰 **免费额度高** — 每月 2,500 次查询，免费使用
- 🌍 **多语言支持** — 支持全球多个国家/地区的搜索结果
- 🔧 **零配置集成** — 一行代码接入 DSH

---

## 快速开始

### 安装

```bash
pnpm add @dsh-web-search-serper
# 或
npm install @dsh-web-search-serper
```

### 配置

在 DSH 的 `cordis.patch.yml` 中添加：

```yaml
- id: web
  config:
    searchProvider: serper

- insert:
    - id: web-search-serper
      name: '@dsh-web-search-serper'
      config:
        apiKey: your-serper-api-key
        gl: cn  # 可选：设置默认国家代码
```

或者通过环境变量：

```yaml
- id: web-search-serper
  name: '@dsh-web-search-serper'
  config:
    apiKey: !!js process.env.SERPER_API_KEY
```

然后设置环境变量：

```bash
export SERPER_API_KEY=your-api-key-here
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
| `apiKey` | string | 否 | `$SERPER_API_KEY` | Serper API 密钥 |
| `baseURL` | string | 否 | `https://google.serper.dev` | API 端点基址 |
| `gl` | string | 否 | - | 国家代码（如 `us`, `cn`, `jp`） |
| `cr` | string | 否 | - | 地区代码（如 `cr=us`） |
| `numResults` | number | 否 | 10 | 默认结果数量 |

---

## 使用示例

### 基础搜索

```typescript
import { apply } from '@dsh-web-search-serper'

// 在 Cordis 插件中使用
apply(ctx, {
  apiKey: 'your-api-key',
  gl: 'cn',
})
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
| `WEB_PROVIDER_CONFIGURED_UNAVAILABLE` | provider 已注册但不可用 | 检查 API Key 是否有效 |
| `WEB_ABORTED` | 请求被中止 | 检查 AbortSignal |
| `WEB_PROVIDER_ERROR` | API 请求失败 | 检查网络/API Key/速率限制 |

---

## 限制与已知问题

1. **免费额度限制** — 每月 2,500 次查询，超出后需付费
2. **仅支持 Google 搜索** — 不支持 Bing、Baidu 等其他搜索引擎
3. **无生成答案** — 仅返回搜索结果列表，不包含 AI 生成的摘要
4. **需要 API Key** — 必须在配置中提供有效的 Serper API Key

---

## 相关项目

- [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) — DSH 主项目
- [Serper.dev](https://serper.dev) — Google Search API 服务
- [@dsh-web-search-exa](https://www.npmjs.com/package/@dsh-web-search-exa) — Exa 搜索提供方
- [@dsh-web-search-perplexity](https://www.npmjs.com/package/@dsh-web-search-perplexity) — Perplexity 搜索提供方

---

## 许可证

MIT License — 见 [LICENSE](LICENSE) 文件

---

## 贡献

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

---

## 支持

如有问题，请：
- 提交 [GitHub Issue](https://github.com/dingpenghui-good/dsh-web-search-serper/issues)
- 查阅 [文档](https://github.com/dingpenghui-good/dsh-web-search-serper#readme)
