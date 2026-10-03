# 发布说明 v1.1.1

**日期：** 2026-10-03

## 修复 / Fixes

- **`package.json` 依赖模型重构**：`@deepseek-ai/dsh-web@0.2.0-rc.2` 与 `@deepseek-ai/schemastery@^3.18.4` 从运行时 `dependencies` 移到 `peerDependencies`（标 `optional: true`），仅保留 `@deepseek-ai/cordis` 作为 peer。
  - 根因：本插件是 **DSH 宿主扩展**，运行时在宿主进程内执行。宿主已经把 `@deepseek-ai/dsh-web` / `schemastery` 加载进同一进程作为宿主模块。本插件若再以 `dependencies` 携带同版本包，pnpm 会在插件树里**再实例化一份同包**，`dsh-tools` 内部的 `TOOL_RUNTIME_SCHEDULER` Symbol 跨实例查不到，宿主调度器取到 `undefined`，触发 `Cannot read properties of undefined (reading 'prepare')` 整轮崩溃（详见 10-03 崩溃调查报告）。
  - 改动：`dependencies: {}`；`peerDependencies` 新增 `dsh-web`、`schemastery`（标 optional）；`peerDependencies` 保留 `cordis`（宿主必备，不标 optional）。
  - 影响：插件自身代码行为不变，只改变了"谁提供这些包"——现在统一由 DSH 宿主提供，单实例，Symbol 身份不分裂。

- **`tsdown.config.ts` 客户端外部化 `@deepseek-ai/dsh-web`**：`CLIENT_EXTERNALS` 新增 `'@deepseek-ai/dsh-web'`，避免客户端 bundle 把 `dsh-web` 打包进 `client.js`，与宿主保持单实例。

## 不变 / Unchanged

- `/supply-chain` 命令、`web-search-serper` 斜杠命令、`ctx.web.search` 拦截逻辑、Serper key 解析链（config → env → credentials store）、自动降级到 `deepseek-official` 全部保持不变。
- `smoke-test.mjs` 不变（仅验证 provider 注册/调用路径）。

## 升级指引 / Upgrade

- 从 `1.1.0` 升到 `1.1.1` 无 breaking change，直接 `pnpm update @dingpenghui/dsh-web-search-serper` 即可。
- 插件安装后宿主行为不变，但不再在插件树里携带 `dsh-web` / `schemastery` 副本。
