# v1.2.0 — 适配 DSH 0.1.7 (Web GUI 0.1.7-rc.2)

## 背景

DSH 从 `0.2.0-rc.2` 回退到 `0.1.7-rc.2` 后，`1.1.1` 无法在当前运行时上工作：

```
Plugin @dingpenghui/dsh-web-search-serper@1.1.1 is incompatible with dsh 0.1.7-rc.2:
requirements {"@deepseek-ai/dsh-web":"0.2.0-rc.2"}.
```

即使放宽 peer 门禁，插件也会因下列接口差异在运行期失效。`1.2.0` 针对
**DSH 0.1.7-rc.2** 重写了受影响的半边。

## 接口差异与修复

| 位置 | 0.2.0-rc.x（旧） | 0.1.7-rc.x（当前） | 修复 |
|------|------------------|--------------------|------|
| 错误基类 | `WebError` 自带实现 | `WebError extends HarnessError`（`@deepseek-ai/dsh-llm`） | 取消判定改为 `instanceof HarnessError && code === 'WEB_ABORTED'`，跨模块副本仍成立 |
| 依赖声明 | `dsh-web` 作 peer，版本钉死 `0.2.0-rc.2` | 兼容性门禁拒绝不匹配的 `@deepseek-ai/dsh-*` peer | `dsh-web` / `dsh-llm` 改为普通 `dependencies`（`0.1.7-rc.2`），peer 只留 `cordis` / `schemastery` |
| Host 配置读取 | 假定 `settings.describe()` 直接返回普通值 | `volatile()` 字段以 `{ get(): value }` 包装返回 | 新增 `plain()` 解包（与宿主 `plainConfig` 同语义），裸值仍兼容 |
| Client slot API | `ctx.slots.inject(...)` 服务方法 | `ctx.slots.inject(name, register)`，`import type {} from '…/client'` 引入契约合并 | 客户端入口与 slot 契约按新 API 重写 |
| SettingsForm | 传入自定义 `onSave`/`onDiscard` 包装 | `SettingsForm` 只接 `labels` / `state` / `onSave` / `onDiscard`，状态为 `SettingsFormShell` | 控制器改为 `SettingsFormModel` + `ConfigForm` 适配，去掉 `as never` 类型逃生舱 |
| 页面挂载 | 直接在 `apply()` 里注册 slot | `configForms.whileServed([ns], …)` 跟随 Host 是否在 serve 该命名空间 | 命名空间就绪才出现，不可用时自动撤下 |
| 客户端说明符 | 会 `require('@deepseek-ai/dsh-client-ui-slots')` | 客户端只应 require 模块表里有的包 | 值导入收敛到 `react/jsx-runtime` 与 `@deepseek-ai/dsh-client-ui-primitives` 两个说明符 |
| 字典注册 | 用包内封装的 locale 入口 | `ctx.locale.register(ns, { zh, en })`（`inject: ['slots','locale','configForms']`） | 改为服务调用 |
| 端点 | — | — | `baseURL` 末尾 `/` 不再拼出 `//search` |

## 兼容性

| DSH 运行时 | 插件版本 |
|------------|----------|
| `0.1.7-rc.x`（已验证 `0.1.7-rc.2`） | `1.2.x` |
| `0.2.0-rc.x` | `1.0.x` – `1.1.x` |

## 验证

- `pnpm run typecheck`（tsc，基于 0.1.7-rc.2 的公开类型面）通过
- `pnpm run build`（tsdown）通过，产物只外置 `schemastery` / `dsh-llm` / `dsh-web`
- `pnpm run test`（`smoke-test.mjs`）：本地回环 HTTP server 上验证请求体（`q`/`gl`/`num`、`X-Api-Key`）、organic → sources 映射、429 降级、取消不降级、volatile 包装解包、缺 key 降级；并校验客户端 bundle 只 require 模块表说明符
- 在真实安装位置上用真实 `WebError` 类跑通一次 Serper 搜索（`available()` → `search()` → sources），`AbortError` 被包装为 `WebError{code:'WEB_ABORTED'}`
- 按宿主 `evaluatePluginCompatibility` 同款逻辑判定：无可拒 peer

## 升级方式

覆盖安装即可（旧版本不需要额外清理）：

```bash
dsh plugin add @dingpenghui/dsh-web-search-serper@1.2.0
```

之后完全重启 DSH（插件代码是 ESM，进程内缓存不会热刷新）。
