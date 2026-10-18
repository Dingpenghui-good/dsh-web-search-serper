# v1.2.7 — 可观测性：让「装了却没生效」不再无迹可寻

## 背景：一次真实的误判

有用户反馈：天气查询没有走 Serper。排查后发现，插件其实**安装正常、版本正常、
配置也写进了 `cordis.patch.yml`**，但当前 DSH 进程从未加载它。时间线是：

| 时间 | 事件 |
| --- | --- |
| 12:26 | 卸载旧版 |
| 12:27 | 安装 `1.2.5` |
| 12:32 | `cordis.patch.yml` 被改写（含 `web-search-serper` 配置） |
| 12:36 | 该会话开始查天气 |

问题不在插件代码，而在两点叠加：

1. **`cordis.patch.yml` 只在 DSH 进程启动时读取一次。** 进程先启动、配置后
   写入，插件层就不会被加载，而搜索会**安静地**继续走内置后端，不报任何错。
2. **插件全程没有任何可观测性。** 注册、被寻址、调用、降级、失败——每一步
   都是无声的。用户既看不到「没加载」，也看不到「加载了但没被选中」。

结果是：插件本身完全正常，用户却只能靠猜。

## 本次改动

### 1. 注册与路由的日志留痕

`apply()` 成功时记录一行（这是「插件真的在本进程生效」的唯一证据）：

```
web-search-serper: registered search provider "serper" (key source: credential)
```

并主动检测两种「加载了但不会被调用」的情形，各给出一条警告：

```
web-search-serper: web.searchProvider is "deepseek-official", not "serper" —
this plugin is loaded but will not be used until the web row selects it

web-search-serper: the web row does not declare searchProvider —
this plugin is registered but the seam will not route searches to it
```

### 2. 降级与失败写日志

此前降级是静默的——用户以为在用 Serper，实际是别的后端给的结果：

```
web-search-serper: fell back to "deepseek-official" — serper failed: <原因>
web-search-serper: search failed and no usable fallback — <原因>
```

### 3. 新增 `readRuntimeStatus()`

```js
import { readRuntimeStatus } from '@dingpenghui/dsh-web-search-serper'
readRuntimeStatus()
```

返回：

```ts
{
  registered: boolean          // 插件层是否已加载并注册到 seam
  calls: number                // 本进程累计调用次数
  serperHits: number           // 其中真正走 Serper 成功的次数
  fallbacks: number            // 其中发生降级的次数
  last?: {
    outcome: 'serper-ok' | 'fallback-ok' | 'failed' | 'aborted'
    servedBy: string           // 本次实际提供结果的 provider id
    at: number
    durationMs: number
    error?: string             // 截断至 300 字符
    keySource: 'config' | 'env' | 'credential' | 'missing'
  }
}
```

判定方式：

- `registered: false` → 插件层没加载，**重启 DSH**；
- `registered: true` 但 `calls: 0` → 加载了但没被寻址（`searchProvider` 未指向
  `serper`，或从未搜索）；
- `keySource` 用于区分「我以为配了 key」与实际读到的来源。

**该快照不包含 key 值本身**，只有来源枚举，可安全打日志或贴进 issue。

### 4. 文档

`README.md` / `README.zh.md` 新增「排障：装了、配了，为什么搜索还是不走
Serper？」一节，给出 5 步定位流程，并说明 DSH 配置只读一次的时机问题。

## 不变的部分

- **搜索行为完全未变**：仍是「优先 Serper，失败自动降级」；
- **默认配置未变**（`cordis.patch.yml` 依旧不含任何 key）；
- 未新增任何运行时依赖。

## 验证

- `pnpm run typecheck` 通过
- `pnpm run build` 通过
- `pnpm test` 通过：`OK all serper plugin contract checks passed`
- `smoke-test.mjs` 新增可观测性回归护栏：
  - `apply()` 后 `readRuntimeStatus().registered === true`；
  - 至少记录一次调用，且 `last.outcome` / `last.keySource` 落在已知枚举内；
  - 状态快照**不得泄漏 key 值**；
  - 未调用 `apply()` 的独立模块实例报告 `registered: false`、`calls: 0`。

## 升级

```bash
dsh plugin --profile desktop add @dingpenghui/dsh-web-search-serper@1.2.7
```

升级后**重启宿主**。重启后可在日志里确认这一行：

```
web-search-serper: registered search provider "serper"
```
