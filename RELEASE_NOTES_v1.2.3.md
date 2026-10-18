# v1.2.3 — 修复安装被 DSH 兼容性门禁拒绝

## 问题

在 DSH **0.2.1-rc.2** 上安装 `1.1.1` 会被直接拒绝：

```
dsh: installation rejected: Plugin @dingpenghui/dsh-web-search-serper@1.1.1
is incompatible with dsh 0.2.1-rc.2: requirements {"@deepseek-ai/dsh-web":"0.2.0-rc.2"}
dsh: restored package.json, pnpm-lock.yaml, and node_modules.
```

`web_search` 因此一直落在 dsh-base 自带的 `deepseek-official` 上，本插件从未生效。

## 根因

DSH 的安装门禁在 `@deepseek-ai/dsh-app-boot` 的 `evaluatePluginCompatibility`：

- 若清单里有 `engines.dsh`，**只看它**，`peerDependencies` 被忽略；
- 否则逐个检查 `@deepseek-ai/dsh` 与 `@deepseek-ai/dsh-*` 的 `peerDependencies`，
  判定式为 `semver.satisfies(runtime, range, { includePrerelease: true })`。

`1.1.1` 没有 `engines.dsh`，且把 `@deepseek-ai/dsh-web` 钉成**精确版本**
`0.2.0-rc.2`。即使开启 `includePrerelease`，`0.2.1-rc.2` 也不满足 `0.2.0-rc.2`，
因此判定不满足并被拒绝安装。

> 注：`0.2.1-rc.2` 的 web seam 实际只有两处内部变化——`Config` 字段改为
> `volatile()`、`search()`/`fetch()` 在调用时惰性读取配置；`WebSearchProvider`
> 契约、`WebError`、`resolveProvider` 与 `capSources` 的语义均未改变。
> 也就是说**代码本来就能跑**，被拦下的纯粹是版本声明。这一点已用从运行
> app.asar 中抽取（SHA-256 校验）的 `dsh-web@0.2.1-rc.2` 逐行比对确认，并在真实
> `0.2.1-rc.2` 类型下通过 `tsc` 与 `tsdown` 构建。

## 修复

1. **`engines.dsh` 单一来源**：`">=0.2.0-rc.2 <0.3.0-0"`。存在 `engines.dsh` 时
   宿主只依据它判定，不再被 peer 上的精确版本误伤。
2. **移除对宿主运行时包的 peer 声明**：`@deepseek-ai/dsh-web` /
   `@deepseek-ai/dsh-llm` 由 DSH 宿主提供，不应再用 peer 钉版本；peer 只保留
   `cordis` / `schemastery`（`cordis ~4.0.5`、`schemastery ~3.18.5`，与
   `0.2.1-rc.2` 运行时一致）。
3. **依赖与构建对齐运行时**：`devDependencies` 全部升到 `0.2.1-rc.2`
   （含 7 个 client 平台包），`cordis` 升到 `4.0.5`、`schemastery` 升到 `3.18.5`。
4. **回归护栏**：`smoke-test.mjs` 新增兼容性断言，优先调用**宿主自己的**
   `evaluatePluginCompatibility`（宿主不可用时回退到语义等价的实现），要求
   本清单在 `0.2.0-rc.2` / `0.2.1-rc.2` 上可安装、在 `0.3.0` / `0.1.5` 上被拒绝，
   并禁止把 `@deepseek-ai/dsh-web` 重新钉回 `peerDependencies`。

## 验证

在 DSH Desktop `0.2.1-rc.2` 上：

- `plugin_manager install_bundle` → `application: applied`，`warnings: []`；
  宿主 inspect 显示 `web-search-serper` 行已挂载且 Config schema 正常；
- 走真实 `web_search` 工具返回结果；
- 针对**已安装包**的 12 项检查全部通过：
  真实打 Serper 端点（带 `X-Api-Key`，非降级路径）、`maxResults` 由 seam 截断、
  丢弃无 `link` 条目、上游 500 自动降级、无 key 且无降级目标时抛
  `WEB_PROVIDER_CONFIGURED_UNAVAILABLE`、真实凭据调用成功、取消信号映射为
  `WEB_ABORTED` 且不降级。

## 升级

```bash
dsh plugin --profile desktop add @dingpenghui/dsh-web-search-serper@1.2.3
```

或直接在插件管理器里安装 `@dingpenghui/dsh-web-search-serper@1.2.3`。
`1.2.2` 及更早版本在 `0.2.1-rc.2` 上不会被门禁拦下，但仍建议升级到 `1.2.3`
以获得正确的 `engines.dsh` 声明与回归护栏。
