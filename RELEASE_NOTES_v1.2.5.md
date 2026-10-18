# v1.2.5 — 修复插件页配置区把占位符伪装成已填值

## 问题

在插件列表里点插件名进入的**插件页**，API Key 一栏会显示 `••••••••`，
看起来像「key 已配置」，但该输入框**无法输入**：

- 那个圆点是 `placeholder` 占位符（`src/shared.ts` 的
  `SERPER_SETTINGS_FIELDS` 中 `apiKey` 的 `placeholder: '••••••••'`），
  实际 `config.apiKey` 为空；
- 该页面**在设计上就是只读的**，无法在此编辑。

用户因此很容易误判成「已配置好」或「界面坏了」。

## 根因

### 1. 只读分支存在无效读取（恒为空）

`src/client/plugin-detail-page.tsx` 的只读分支：

```ts
if (form === undefined) {
  const value = form?.state.value    // form 已在上一行判定为 undefined，恒为 undefined
  const section = value !== null && typeof value === 'object' ? value : {}
```

在已判定 `form === undefined` 的分支里又用 `form?.` 读取，结果 `section`
恒为空对象——即便宿主将来传了值也显示不出来。此为死代码 + 逻辑错误。

### 2. 只读视图渲染了 `placeholder`

只读 `input` 同时渲染 `value` 与 `placeholder`。当值为空时浏览器显示
placeholder，对 `secret` 字段（`type="password"`）尤其误导：`••••••••`
与真实密码掩码外观完全一致。

### 3. 提示文案指向不明确

原文案「请在插件行的「配置」页中修改并保存」没有说明从哪进入。

## 平台事实（为什么不能直接把插件页改成可编辑）

宿主 `@deepseek-ai/dsh-client-ui-plugin-manager` 渲染两条不同路径：

```js
// 插件页（点插件名进入）：不传 form
renderSlot("plugins.bundle.config", { view: "page" }, { entryKey: pkg.name })

// 行配置页（点行上的「配置」）：传 form
renderSlot("plugins.row.config", { view: "page", form }, { entryKey: key })
```

`plugins.bundle.config` 的 props 里没有 `form`，插件无从获得 `mutate`
通道，因此**该页面只读是平台契约**，插件侧无法绕过。

可编辑入口：插件页**下方行列表**中该插件那一行（按钮 `aria-label` 为
「配置 <rowId>」，右侧带 `›`），点击后进入 `plugins.row.config`，此处
才携带 `form`，可编辑并保存。

## 修复

| 位置 | 修改 |
| --- | --- |
| `plugin-detail-page.tsx` 只读分支 | 删除无效的 `form?.state.value`，改为显式空快照并注明原因 |
| `plugin-detail-page.tsx` 只读 `input` | **移除 `placeholder`**，避免 secret 字段伪装成已填值；补充 `aria-disabled`；提示容器加 `role="note"` |
| `locales/index.ts`（zh / en） | `page.readOnlyHint` 改为明确的分步指引：此页只读，请返回插件列表、在该插件行点击「配置」 |

> 可编辑表单（`plugins.row.config`）的行为**未改动**，本次只影响只读视图。

## 验证

- `pnpm run typecheck` 通过
- `pnpm run build` 通过（client bundle 16.58 kB → 16.61 kB）
- `pnpm test` 通过：`OK all serper plugin contract checks passed`

## 升级

```bash
dsh plugin --profile desktop add @dingpenghui/dsh-web-search-serper@1.2.5
```

升级后需**重启宿主**（client bundle 是 ESM，进程内缓存不会自动刷新）。
