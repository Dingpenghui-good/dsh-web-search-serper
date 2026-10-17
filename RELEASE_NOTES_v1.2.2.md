# v1.2.2 — 适配 DSH 0.2.0-rc.2

## 目标运行时

本版本以 **DSH 0.2.0-rc.2** 为目标：

| 依赖 | 版本 |
|------|------|
| `@deepseek-ai/dsh-web` | `0.2.0-rc.2`（普通依赖） |
| `@deepseek-ai/dsh-llm` | `0.2.0-rc.2`（普通依赖） |
| `@deepseek-ai/cordis` | `~4.0.4`（peer） |
| `@deepseek-ai/schemastery` | `~3.18.4`（peer，可选） |

`dsh-web` / `dsh-llm` 声明为普通依赖而非 peer，是为了不让：

```
Plugin @dingpenghui/dsh-web-search-serper is incompatible with dsh <runtime>:
requirements {"@deepseek-ai/dsh-web":"..."}
```

这类兼容性门禁挡住加载（该门禁只检查以 `@deepseek-ai/dsh-` 开头的 **peer**）。

## 相对 1.1.1 的修复

| 位置 | 1.1.1 | 1.2.2 |
|------|-------|-------|
| 错误类型 | 从 dsh-web import `WebError`，跨版本安装时类身份可能不同 | 用 seam 的 `WebError` 作为基类（`SerperWebError extends WebError`），`instanceof WebError` 与宿主一致，`code`/`cause` 语义不变 |
| 取消判定 | `error instanceof WebError && code === 'WEB_ABORTED'` | 改为 `instanceof HarnessError && code === 'WEB_ABORTED'`，跨模块副本也成立 |
| 行配置读取 | 只处理裸值 | 额外解包 `ctx.settings.describe()` 里的 `volatile()` 包装（`{ get(): T }`），与宿主 `plainConfig` 同语义——否则用户保存的 key/端点会静默失效 |
| 客户端页面 | 自建 staged form，假定 `plugins.bundle.config` 会收到 `form` | 按 0.2.0-rc.2 的真实渲染：`plugins.bundle.config` **不传 form**（只读概览），`plugins.row.config` 才传 `form`（用 `SettingsFormModel` + `SettingsForm` 走宿主 `mutate` 保存） |
| 页面挂载 | 直接在 `apply()` 注册 slot | `configForms.whileServed([ns], …)`：命名空间被 serve 才出现，缺失时降级为直接注册并提示 |
| 客户端依赖面 | 会 `require('@deepseek-ai/dsh-client-ui-slots')` 等模块表里不存在的包 | 只 require `react` / `react/jsx-runtime` / `@deepseek-ai/dsh-client-ui-primitives` |
| 端点拼接 | `baseURL` 末尾有 `/` 时拼出 `//search` | 统一去掉尾部 `/` |
| 类型 | 依赖官方包的类型声明 | 0.2.0-rc.2 的客户端包**不带 `.d.ts`** 且该版本线未在 npm 发布类型包，因此 `src/contracts.d.ts` / `src/client/*.d.ts` 按运行时实现逐项声明所消费的契约 |

## 兼容性

| DSH 运行时 | 插件版本 |
|-----------|----------|
| `0.2.0-rc.x`（已验证 `0.2.0-rc.2` 的完整类型面与运行时） | `1.2.2` |
| `0.1.7-rc.x` | `1.2.0` |
| `0.2.1-rc.x` | 尚未支持（该版本线的客户端公共包未发布，无法取得类型或运行时依赖） |

## 验证

- `pnpm run typecheck`：**0 错误**（基于 `src/contracts.d.ts` 的本地契约声明）
- `pnpm run build`：产物只外置 `schemastery` / `dsh-llm` / `dsh-web`
- `pnpm run test`：本地回环 HTTP server 上验证请求体（`q`/`gl`/`num`、`X-Api-Key`）、organic → sources 映射、429 降级、取消不降级、volatile 包装解包、缺 key 降级；并校验客户端 bundle 只 require 模块表说明符
- 用真实的 `0.2.0-rc.2` `WebError` 类跑通一次真实 Serper 搜索：`available()` → `search()` → 3 条 sources，取消被包装为 `WebError{code:'WEB_ABORTED'}` 且 `instanceof WebError === true`

## 未验证项（如实说明）

1. **客户端界面的可视化验证**：本会话无法访问 Web GUI（鉴权），因此设置页在「插件」页上的实际渲染没有截图确认；已通过构建产物与运行时契约核对。
2. **类型声明的来源**：`src/contracts.d.ts` 与 `src/client/primitives.d.ts` / `store.d.ts` 是按安装包内的 `lib/*.js` 逆向写出的最小契约，不是官方类型；官方若在某版本线补齐类型声明，应替换为本包对该包的正式依赖。

## 升级方式

```bash
dsh plugin add @dingpenghui/dsh-web-search-serper@1.2.2
```

覆盖安装后**完全重启 DSH**（插件代码是 ESM，进程内缓存不会热刷新）。
