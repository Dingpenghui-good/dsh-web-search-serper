# v1.2.4 — 补发 v1.2.3 到 npm（无代码变更）

## 为什么有这版

`v1.2.3` 的修复只推送到了 GitHub（tag `v1.2.3`），**从未发布到 npm**。
npm registry 上的 `latest` 一直停留在 `1.2.2`，因此：

```bash
dsh plugin add @dingpenghui/dsh-web-search-serper   # 实际装到 1.2.2
```

会装到**不含**兼容性修复的版本。`1.2.4` 与 `1.2.3` 的代码、依赖、默认配置
**完全一致**，仅用于把修复同步到 npm，让 `latest` 重新对齐。

## 包含的内容（即 v1.2.3 的全部修复）

- 兼容范围由 `engines.dsh` 单一表达：`>=0.2.0-rc.2 <0.3.0-0`；
- 移除对宿主运行时包（`@deepseek-ai/dsh-web` / `dsh-llm`）的 peer 版本钉死，
  修复在 DSH `0.2.1-rc.2` 上被安装门禁拒绝的问题；
- peer 仅保留 `cordis ~4.0.5` / `schemastery ~3.18.5`；
- `smoke-test.mjs` 兼容性回归护栏。

详见 [RELEASE_NOTES_v1.2.3.md](./RELEASE_NOTES_v1.2.3.md)。

## 关于默认配置：安装后所有人一致

`cordis.patch.yml`（随包分发，`files` 白名单包含）中的默认配置**不含任何
API Key**，所有安装者拿到的默认层完全相同：

```yaml
- id: web
  name: '@deepseek-ai/dsh-web'
  config:
    searchProvider: serper
    fetchProvider: http

- insert:
    - id: web-search-serper
      name: '@dingpenghui/dsh-web-search-serper'
```

API Key 无需写进配置，每次搜索时按以下顺序惰性解析：

1. 行 `config.apiKey`（仅在你自己的 profile 覆盖层里显式配置时才存在）；
2. 宿主进程环境变量 `SERPER_API_KEY`；
3. 凭证库引用 `SERPER_API_KEY`（`$DSH_HOME/.credentials.yaml` 的 `refs:`）。

> 也就是说：**默认配置对所有人相同**；个人密钥只应放在环境变量或凭证库，
> 不要写进 composition 的 `config.apiKey`，更不要提交到仓库。

## 升级

```bash
dsh plugin --profile desktop add @dingpenghui/dsh-web-search-serper@1.2.4
```

或直接在插件管理器里安装 `@dingpenghui/dsh-web-search-serper@1.2.4`。
