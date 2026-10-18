# dsh-web-search-serper

[English](README.md) | 中文

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![DeepSeek Harness](https://img.shields.io/badge/DSH-Compatible-blue.svg)](https://github.com/deepseek-ai/deepseek-harness)

## 概述

`@dingpenghui/dsh-web-search-serper` 是一个基于 Serper.dev API 的 Web 搜索提供方插件，适配 DeepSeek Harness (DSH) 的 web 能力 seam（`ctx.web`，`@deepseek-ai/dsh-web` `0.2.0-rc.x`）。本版本针对 DSH **0.2.0-rc.2** 与 **0.2.1-rc.2** 构建与验证。

Serper.dev 是 Google 搜索的官方合作伙伴，提供高速、结构化的 Google 搜索结果 API。免费额度：**每月 2,500 次查询**，无需信用卡。

### 特性

- 🚀 **高速搜索** — 1-2 秒响应，基于 Google 真实索引
- 📊 **结构化结果** — JSON 格式返回，易于解析
- 🔒 **隐私友好** — 不追踪用户，无 Cookie 收集
- 💰 **免费额度高** — 每月 2,500 次查询，免费使用
- 🌍 **多语言支持** — 支持全球多个国家/地区的搜索结果
- 🔧 **开箱接管** — 作为 bundle 安装后自动接管 `web.searchProvider`；key 每次搜索惰性解析（config → 环境变量 → 凭证库），改动无需重启
- 🛟 **失败自动降级** — Serper 不可用时自动回退到其它可用搜索提供方，不会让 `web_search` 整体失效
- ⚙️ **插件页内的设置界面** — 在「插件」列表点插件名（或行上的「配置」）即可编辑 Key、端点、`gl` / `cr` 与默认结果数量；保存后对下一次搜索即时生效，无需重启
- 🔁 **配置热读取** — 每次搜索都重读行 config（含 `ctx.settings.describe()` 中以 `volatile()` 包装返回的值），所以在别处改动凭证或选项同样立即生效

---

## 快速开始

### 安装

```bash
# 方式一：从 npm 安装（推荐）
dsh plugin --profile web add @dingpenghui/dsh-web-search-serper

# 方式二：本地 bundle（link:）
# 1. 在 profile 的 package.json `dependencies` 加：
#    "@dingpenghui/dsh-web-search-serper": "link:<本目录绝对路径>"
# 2. 同步 `dsh.profile.bundles` 加 "@dingpenghui/dsh-web-search-serper"
#    并让 pnpm 把本包自带的 cordis.patch.yml 作为 bundle patch 应用
#    （也可以直接把 insert 行手动加到 profile 的 cordis.patch.yml）
pnpm install
pnpm run build
```

### 配置

**作为 bundle 安装时（推荐）无需任何手动配置。** 本包自带的 `cordis.patch.yml`
会随 bundle 一起生效，把 web seam 的搜索提供方接管为 `serper`：

```yaml
- id: web
  name: '@deepseek-ai/dsh-web'
  config:
    searchProvider: serper     # 覆盖 dsh-base 默认的 deepseek-official
    fetchProvider: http        # 必须重述：patch 会整行替换 config
- insert:
    - id: web-search-serper
      name: '@dingpenghui/dsh-web-search-serper'
```

> **为什么必须接管？** `dsh-base` 把 `web.searchProvider` 固定为
> `deepseek-official`，而 web seam 的选择语义是「配了 id 就只用它、失败也不
> 换人」。只 `insert` 而不管接管的话，本插件即使注册成功也永远不会被调用，
> 而且**不报任何错**。profile 自己的 `cordis.patch.yml` 在 bundle 层之后应用、
> 优先级更高，想换回其它搜索后端时在自己的 patch 里覆盖 `- id: web` 即可。

若你不走 bundle 机制、而是手动把行复制进 profile patch，请把上面**两段一起**
复制过去，否则同样不会生效。

API key 无需配置即可工作，每次搜索时按以下顺序惰性解析：

1. 行 `config.apiKey`（显式配置，需给行加 `config` 块；插件详情页保存后经 volatile HMR 即时生效）；
2. DSH 宿主进程的环境变量 `SERPER_API_KEY`；
3. DSH 凭证库中的 `SERPER_API_KEY` 引用
   （`$DSH_HOME/.credentials.yaml` 的 `refs:` —— 每次搜索实时解析，改动无需重启）。

在 composition 中固定 key 与选项：

```yaml
- id: web-search-serper
  name: '@dingpenghui/dsh-web-search-serper'
  config:
    apiKey: your-serper-api-key
    gl: cn  # 可选：设置默认国家代码
```

### 运行行为：优先 Serper，失败自动降级

- **优先** — 只要 Serper 配置就绪（有 key、端点合法），一律走 Serper；
- **降级** — Serper 因任何原因失败（无 key、401/403 鉴权失败、429 限流、5xx、
  网络异常、端点配置错误等）时，自动改用 seam 上其它已注册且可用的搜索提供方，
  通常是 `dsh-base` 自带的 `deepseek-official`；
- **不降级** — 用户主动取消（`WEB_ABORTED`）不触发降级；
- **两侧都失败** — 上抛 `WEB_PROVIDER_ERROR`，消息同时包含主后端与降级后端的
  失败原因，降级错误挂在 `cause` 链上。

> **重启须知** — DSH 的 `patchReload: live` 会热重载配置层（`cordis.patch.yml`），但插件代码（`lib/index.js`）是 ESM 模块，进程内缓存不会自动刷新。所以即使配置（如接管）立即生效，插件内部逻辑（如降级）需要**重启宿主**后才能生效。

降级在**插件内部**完成，因为 DSH 的 web seam 自身不做回退（配置了 id 就只用它）。
相应地，`available()` 在「Serper 侧不可用、但存在可降级目标」时仍返回 `true` ——
否则 seam 会在进入 `search()` 之前就以 `WEB_PROVIDER_CONFIGURED_UNAVAILABLE`
拦下，降级根本无从发生。

### 设置界面（插件页）

Client 半边把插件自己的配置页注册进「插件」页声明的两个 slot：
`plugins.bundle.config`（以 npm 包名为 key，显示在插件自己的页面上）与
`plugins.row.config`（以 `@dingpenghui/dsh-web-search-serper#web-search-serper`
为 key，行上的「配置」控件打开它）。两者都经 `configForms.whileServed` 跟随
Host 实际在 serve 的 settings 命名空间：命名空间被 serve 时才出现，不再
被 serve 时自动撤下。

可编辑项：API Key、端点基址、`gl`、`cr`、默认结果数量。在 `0.2.x` 上：
插件页（`plugins.bundle.config`）只承担只读概览，真正的编辑与保存发生在行的
「配置」页（`plugins.row.config`），经宿主设置表单写入插件行 config。

由于每次搜索都会重读 `ctx.settings.describe()`（`volatile()` 字段在其中以
`{ get(): value }` 包装返回，插件按宿主 `plainConfig` 同样的方式解包），
保存后的值对下一次搜索立即生效，**无需重启宿主**。

### 兼容性

| DSH 运行时 | 插件版本 |
|-----------|----------|
| `0.2.x`（已在 `0.2.0-rc.2` 与 `0.2.1-rc.2` 上验证） | `1.2.3` |
| `0.1.7-rc.x` | `1.2.0` |

`1.2.3` 起用 `engines.dsh`（`>=0.2.0-rc.2 <0.3.0-0`）**统一表达** DSH 兼容范围，
并且**不再**把 `@deepseek-ai/dsh-web` / `@deepseek-ai/dsh-llm` 写进
`peerDependencies`。原因见下节。

**为什么 `1.1.1` 装不上：** DSH 的安装门禁（`dsh-app-boot` 的
`evaluatePluginCompatibility`）在没有 `engines.dsh` 时，会逐个检查
`@deepseek-ai/dsh-*` 的 `peerDependencies`，并用
`semver.satisfies(runtime, range, { includePrerelease: true })` 判定。`1.1.1` 把
`@deepseek-ai/dsh-web` 钉成精确版本 `0.2.0-rc.2`，而在该规则下
`0.2.1-rc.2` **不满足** `0.2.0-rc.2`，于是安装被拒：

```
Plugin @dingpenghui/dsh-web-search-serper@1.1.1 is incompatible with dsh 0.2.1-rc.2:
requirements {"@deepseek-ai/dsh-web":"0.2.0-rc.2"}
```

`1.2.3` 让 `engines.dsh` 单独决定兼容性（存在 `engines.dsh` 时宿主只看它、忽略
peer），同时移除对 DSH 运行时包的 peer 声明——这些包由宿主提供，不应由插件再装
一份。`smoke-test.mjs` 增加了对应回归护栏：优先调用宿主自己的
`evaluatePluginCompatibility`，宿主不可用时回退到语义等价的实现，确保本插件在
`0.2.0-rc.2` 与 `0.2.1-rc.2` 上都判定为可安装、在 `0.3.0` / `0.1.5` 上被拒绝。

slot / 页面 API 方面，`1.2.3` 与 `1.2.2` 一致：`plugins.bundle.config` 只收到
`view: 'page'`（**没有 `form`**，因此渲染只读概览），`plugins.row.config` 才会
收到行自己的 `form`（`state` + `mutate`），是真正可编辑并保存的视图；两者都经
`configForms.whileServed` 跟随命名空间是否被 serve。

> `0.2.1-rc.2` 的客户端公共包已随包发布 `.d.ts`；插件仍然在
> `src/contracts.d.ts` 与 `src/client/*.d.ts` 里显式声明它消费的契约，以保证
> 跨版本线的类型稳定。

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
import { apply } from '@dingpenghui/dsh-web-search-serper'

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

> 只有**降级目标同样不可用**时，`WEB_PROVIDER_CONFIGURED_UNAVAILABLE` 与
> `WEB_PROVIDER_ERROR` 才会冒泡到 `web_search`；Serper 单独失败会被自动降级
> 吸收（见上文「运行行为」）。

---

## 限制与已知问题

1. **免费额度限制** — 每月 2,500 次查询，超出后需付费
2. **仅支持 Google 搜索** — 不支持 Bing、Baidu 等其他搜索引擎
3. **无生成答案** — 仅返回搜索结果列表，不包含 AI 生成的摘要
4. **需要 API Key** — 必须通过配置、环境变量或凭证引用提供有效的 Serper API Key
5. **一次只对一个 DSH 版本线** — `1.2.3` 支持 DSH `0.2.x`（`>=0.2.0-rc.2 <0.3.0-0`）；换到其它版本线需要对应版本的插件（见「兼容性」）

---

## 相关项目

- [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) — DSH 主项目
- [Serper.dev](https://serper.dev) — Google Search API 服务

---

## 许可证

MIT License — 见 [LICENSE](LICENSE) 文件
