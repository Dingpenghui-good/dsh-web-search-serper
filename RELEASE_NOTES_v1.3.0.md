# v1.3.0 — 只做检索：删掉所有会导致「结果莫名不对」的调参

## 动机

上一版解决了「装好不生效」。这一版解决另一半问题：**设置项太多，且每一个都能悄悄
改变检索语义**。

真实案例：有人在插件详情页把「国家代码」填成了 `cn`，于是英文技术查询开始返回
中文站点的结果。搜索看起来"在工作"，但结果不是想要的——而页面上那几个输入框
让人根本想不到问题出在哪儿。

一个只负责「把查询交给 Serper、把结果交回去」的插件，不应该有这么多旋钮。

## 移除的配置项

| 字段 | 原作用 | 移除理由 |
| --- | --- | --- |
| `gl` | 国家代码 | 让检索结果偏向某地区。`gl: cn` + 英文查询 = 结果全是中文站，且完全无声 |
| `cr` | 地区代码 | 同上，且与 `gl` 语义重叠，实际很少有用 |
| `numResults` | 默认条数 | 会覆盖宿主 `web_search` 工具下发的 `maxResults`，与工具侧预算打架 |
| `baseURL` | 端点基址 | 只有自建代理才需要；开放它等于把凭证发往任意地址 |

**现在只剩 `apiKey`。** 端点固定为 `https://google.serper.dev`，条数由宿主
`tool-web`（默认上限 8）决定，区域跟随 Serper 默认。

## 老配置怎么办

`schemastery` 的 `resolve` 会**原样保留**未声明字段（已实测），所以「从 schema
删掉」本身不足以让残留值失效。真正的保证在代码层：插件只读 `apiKey`，残留的
`gl` / `cr` / `numResults` / `baseURL` 不会被写进任何请求。

回归测试用一份「脏 config」跑真实搜索，断言请求体只剩 `{ q }`。

## 验证

- `pnpm run typecheck` 通过
- `pnpm run build` 通过
- `node smoke-test.mjs` → `OK all serper plugin contract checks passed`
- 新增护栏：
  - `Config` 只声明 `apiKey`；
  - 脏 config 下请求体为 `{ q }`（不含 `gl` / `cr` / `num` / 自定义端点）；
  - 端点始终打到 `google.serper.dev/search`（测试中把 fetch 重定向到本地 mock，
    不消耗真实配额）。

## 升级

```bash
dsh plugin --profile desktop add @dingpenghui/dsh-web-search-serper@1.3.0
```

升级后重启一次宿主。**升级后建议清理 profile 里已失效的字段**：

```yaml
- id: web-search-serper
  config:
    apiKey: <你的 key>
    # gl / cr / numResults / baseURL 已不再读取，可以删掉
```

## 不变的部分

- 装好即生效（v1.2.8 的运行时接管保持不变）；
- 优先 Serper、失败自动降级；
- key 解析顺序：config → 环境变量 → 凭证库。
