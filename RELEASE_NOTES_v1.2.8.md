# v1.2.8 — 装好即生效：接管搜索改为插件运行时自愈

## 背景：装了、配了，搜索却还是不走 Serper

1.2.7 加上了完整的可观测性，把「装了却没生效」变成了可排查的问题。这一版则直接
**把这个问题消灭掉**：任何安装本插件的人，装完就应该在用 Serper，不需要改配置。

排查中确认的链路是：`dsh-base` 自带 `searchProvider: deepseek-official`，而 web seam
的选择语义是「配了 id 就只用它，失败也不换人」。早期版本靠 bundle patch 里的
`- id: web` 整行替换把选择改成 `serper`，但这条接管路径有四个结构性缺陷：

| # | 缺陷 | 后果 |
| --- | --- | --- |
| 1 | patch 语义是**整行替换 `config`** | 必须逐字重述 dsh-base 的每个 key，宿主一加字段就漏 |
| 2 | profile 自己的 `cordis.patch.yml` **优先级更高** | 一句 `- id: web` 就能静默顶掉接管 |
| 3 | `cordis.patch.yml` **只在进程启动时读一次** | 插件装好后不重启就不生效 |
| 4 | 以上任一发生都是**静默的** | 搜索安静地继续走内置后端，不报错 |

## 本次改动

### 1. 接管移到插件运行时（`src/index.ts`）

`apply()` 注册完 provider 后立即调用 `takeOverSearch()`，直接写
`ctx.web.config.searchProvider = 'serper'`。

关键前提（已核对宿主源码 `@deepseek-ai/dsh-web`）：seam 在**每次 `search()` 时**
解析选择，不缓存，所以 `set()` 一次即对后续所有请求生效——**无需改配置、无需重启**。

### 2. 不覆盖你的显式选择

- `$DSH_WEB_SEARCH_PROVIDER` 非空且不是 `serper` → 插件**让位**（seam 侧该环境
  变量本就优先于 config），并输出一条 warn 说明；
- 想换回内置搜索：设该环境变量为 `deepseek-official`，或在 profile patch 里
  整行覆盖 `- id: web`。

### 3. `cordis.patch.yml` 不再写 `- id: web`

只保留 `insert` 插件行。整行替换既脆弱又会在升级宿主时误伤，彻底移除。

### 4. 降级与容错

- seam 已指向 `serper` → 幂等，不重复写；
- seam 无可写 `config`（旧宿主）→ 接管记为失败，**注册照常成功**，并回落到
  1.2.7 的「检查配置并告警」路径，不阻断插件加载。

## 验证

- `pnpm run typecheck` 通过
- `pnpm run build` 通过
- `node smoke-test.mjs` → `OK all serper plugin contract checks passed`
- `smoke-test.mjs` 新增回归护栏：
  - `apply()` 后 `web.config.searchProvider === 'serper'`（**无任何 profile patch**）；
  - `$DSH_WEB_SEARCH_PROVIDER` 为别的值时不被覆盖；
  - 已指向 `serper` 时幂等；
  - seam 缺少可写 config 时 `apply()` 不抛错，provider 仍注册。

## 升级

```bash
dsh plugin --profile desktop add @dingpenghui/dsh-web-search-serper@1.2.8
```

**升级后重启一次宿主**（插件代码是 ESM，进程内缓存不会刷新）。重启后日志里应出现：

```
web-search-serper: registered search provider "serper" (key source: ...)
web-search-serper: took over web.searchProvider (was "deepseek-official")
```

## 不变的部分

- 搜索行为未变：仍是「优先 Serper，失败自动降级」；
- 默认配置未变（`cordis.patch.yml` 依旧不含任何 key）；
- 未新增任何运行时依赖。
