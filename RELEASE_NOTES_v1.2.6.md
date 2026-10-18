# v1.2.6 — 修复设置页输入框无法输入（受控组件未订阅 store）

## 问题

设置页的 API Key、端点基址、国家/地区代码、结果数量**全部无法输入**：
输入框可以聚焦、可以看到光标，但敲键后内容不出现，或立刻被清空。

`v1.2.5` 修的是同一页面的**只读视图**（占位符误导），并未触及本问题；
本版修复的是**可编辑表单**本身。

## 根因

`src/client/plugin-detail-page.tsx` 的 `SerperSettingsForm` 创建了
`SettingsFormModel` 与其 `SnapshotStore`，但**从未订阅该 store**：

```ts
const [page, setPage] = React.useState(() => createPage(props.form))
// ...
const state = page.model.shell()        // 渲染时现取一次
const actions = page.model.actions()    // ...
```

宿主 `SettingsFormModel` 的状态推送机制是：

```js
// @deepseek-ai/dsh-client-ui-primitives 的 SettingsFormModel
constructor(scope, specs, secretSpecs) {
  this.unsubscribe = scope.subscribe(() => { this.publish() })
}
bind(project) {
  const store = createSnapshotStore(project())
  this.listeners.add(() => { store.set(project()) })
  return store
}
publish() { for (const listener of this.listeners) listener() }
```

即：`actions.edit()` → `model.stage()` → `model.publish()`，而 `publish()`
**只把新状态写进 `bind()` 返回的 `SnapshotStore`**，不会触发 React 重渲染。

由于组件没有订阅该 store，React 始终拿不到更新的 `text` 值。而宿主的
`SettingsValueField` 是**受控输入**：

```js
// @deepseek-ai/dsh-client-ui-primitives 的 SettingsValueField
<input
  type="text"
  value={e.text}
  onChange={d => e.onEdit(d.target.value)}
/>
```

于是形成死锁：用户按键 → `onEdit` → model 内部 staged 更新 → 无重渲染 →
`value` 仍是旧值 → 输入被回滚。表现为「完全无法输入」。

> 注：该缺陷不影响只读视图（`plugins.bundle.config`），因为那里用的是普通
> `<input readOnly>`，不依赖 model 的订阅。

## 修复

用 `useSyncExternalStore` 把组件接到真正的 store 上：

```ts
const subscribed = React.useSyncExternalStore(
  page.store.subscribe,
  page.store.getSnapshot,
  page.store.getSnapshot,
)

const state = subscribed
const actions = page.model.actions()
```

`page.model.field(key)` 仍在渲染期调用，因此能读到最新 staged 值；
订阅建立后，`publish()` 才能驱动重渲染，输入得以回显。

同时清理 `SettingsForm` 的 `state` 传参，直接传递订阅得到的快照。

## 验证

- `pnpm run typecheck` 通过
- `pnpm run build` 通过（client bundle 16.61 kB → 16.79 kB）
- `pnpm test` 通过：`OK all serper plugin contract checks passed`
- **实机验证**：替换本地已安装包的 `lib/client.js` 并重启 DSH Desktop
  0.2.1-rc.2，设置页各字段均可正常输入。

## 升级

```bash
dsh plugin --profile desktop add @dingpenghui/dsh-web-search-serper@1.2.6
```

升级后需**重启宿主**（client bundle 为 ESM，进程内缓存不会自动刷新；
仅刷新页面不够）。

## 关于 v1.2.5

`v1.2.5` 修复的是只读视图的占位符误导与提示文案，与本问题无关，未引入
回归。两个版本请都升级到 `1.2.6`。
