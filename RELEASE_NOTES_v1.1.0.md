# @dingpenghui/dsh-web-search-serper v1.1.0

**行为变更版本**：安装后自动接管 `web.searchProvider`，并在 Serper 不可用时自动降级到其它搜索提供方。

## 中文

### 修复：装了却完全不生效

1.0.1 及更早版本存在一个**静默失效**问题：按 README 安装后，插件虽然注册成功，
但 `web_search` **永远不会调用它**，而且**不报任何错**——用户只会觉得"装了没效果"，
无从排查。

原因有两个：

1. `dsh-base`（所有 profile 共享的基础层）把 `web` 行固定为
   `searchProvider: deepseek-official`，而 web seam 的选择语义是
   「配了 id 就只用它、失败也不换人」——插件注册的 `serper` 永远轮不到；
2. 本包自带的 `cordis.patch.yml` 只做了 `- insert:`，从未把 `web.searchProvider`
   指过来。

### 新增：开箱接管

本包现在在自己的 `cordis.patch.yml` 里同时覆盖 `- id: web`：

```yaml
- id: web
  name: '@deepseek-ai/dsh-web'
  config:
    searchProvider: serper     # 覆盖 dsh-base 默认的 deepseek-official
    fetchProvider: http        # 必须重述：patch 会整行替换 config
```

作为 bundle 安装即自动接管，**无需手动修改 profile 配置**。
profile 自己的 `cordis.patch.yml` 在 bundle 层之后应用、优先级更高，
仍可覆盖回其它搜索后端。

> `fetchProvider: http` 必须重述——DSH 的 patch 语义是「整行替换 config」，
> 漏掉它会抹掉 dsh-base 的 fetch 配置。

### 新增：失败自动降级

- **优先** Serper：只要配置就绪（有 key、端点合法）一律走 Serper；
- **降级**：Serper 因任何原因失败（无 key、401/403 鉴权失败、429 限流、5xx、
  网络异常、端点配置错误等）时，自动改用 seam 上其它已注册且可用的搜索提供方，
  通常是 `dsh-base` 自带的 `deepseek-official`；
- **取消不降级**：用户主动取消（`WEB_ABORTED`）直接上抛；
- **两侧都失败**：上抛 `WEB_PROVIDER_ERROR`，消息同时包含主后端与降级后端的
  失败原因，降级错误挂在 `cause` 链上。

降级在**插件内部**完成，因为 DSH 的 web seam 自身不做回退（配置了 id 就只用它）。
相应地，`available()` 在「Serper 侧不可用、但存在可降级目标」时仍返回 `true`，
否则 seam 会在进入 `search()` 之前就以 `WEB_PROVIDER_CONFIGURED_UNAVAILABLE`
拦下，降级根本无从发生。

### 升级注意

- **存量用户**：升级后搜索后端会从 `deepseek-official` 切换到 `serper`。
  若你并不想用 Serper，在自己的 profile patch 里覆盖 `- id: web` 指回
  `deepseek-official` 即可。
- 若你此前因 1.0.1 的缺陷**手动**在 profile patch 里补过 `- id: web`，升级后
  建议删掉那段手动配置，避免将来卸载插件时留下指向 `serper` 的悬空配置
  （会报 `WEB_PROVIDER_CONFIGURED_MISSING`）。

### 安装 / 升级

```bash
dsh plugin --profile web add @dingpenghui/dsh-web-search-serper@1.1.0
```

默认端点仍为 `https://google.serper.dev`（**不是** `https://serper.dev`——后者是
官网，调用会 404）。

---

## English

**Behavior-changing release**: the bundle now claims `web.searchProvider` on
install and falls back to another search provider whenever Serper is unavailable.

### Fixed: installed but silently never used

1.0.1 and earlier had a **silent no-op** defect: after following the README, the
plugin registered successfully yet `web_search` **never invoked it** — and
**reported no error at all**, leaving users with "installed but nothing happens"
and no way to diagnose it.

Two causes:

1. `dsh-base` (the layer shared by every profile) pins the `web` row to
   `searchProvider: deepseek-official`, and the seam's selection rule is
   "a configured id is the only candidate — never a fallback on failure", so the
   registered `serper` provider could never be selected;
2. the package's own `cordis.patch.yml` only did `- insert:` and never pointed
   `web.searchProvider` at itself.

### Added: takeover out of the box

The package's `cordis.patch.yml` now also overrides `- id: web`:

```yaml
- id: web
  name: '@deepseek-ai/dsh-web'
  config:
    searchProvider: serper     # overrides dsh-base's deepseek-official
    fetchProvider: http        # must be restated: a patch replaces the whole config
```

Installing it as a bundle claims the seam automatically — **no manual profile
edits required**. Your profile's own `cordis.patch.yml` is applied after the
bundle layer and wins, so overriding `- id: web` there still switches backends.

> `fetchProvider: http` must be restated: a DSH patch replaces the row's whole
> `config`, and omitting it would drop dsh-base's fetch configuration.

### Added: automatic fallback

- **Preferred** — Serper is used whenever it is ready (key present, endpoint valid);
- **Fallback** — if Serper fails for any reason (missing key, 401/403 auth
  failure, 429 rate limit, 5xx, network error, misconfigured endpoint, …), the
  request goes to another registered and usable search provider on the seam,
  normally the `deepseek-official` provider shipped with `dsh-base`;
- **Not on cancel** — a user cancellation (`WEB_ABORTED`) is rethrown as-is;
- **Both down** — throws `WEB_PROVIDER_ERROR` naming both the primary and the
  fallback failure, with the fallback error on the `cause` chain.

The fallback lives **inside the plugin**, because the DSH web seam does not fall
back by itself (a configured id is the only candidate). Accordingly,
`available()` still returns `true` when Serper is unusable but a fallback target
exists — otherwise the seam would reject the provider with
`WEB_PROVIDER_CONFIGURED_UNAVAILABLE` before `search()` ever ran.

### Upgrade notes

- **Existing installs**: after upgrading, search moves from `deepseek-official`
  to `serper`. If you do not want Serper, override `- id: web` in your own
  profile patch and point it back at `deepseek-official`.
- If you previously patched `- id: web` **by hand** to work around the 1.0.1
  defect, remove that manual block after upgrading, so uninstalling the plugin
  later does not leave a dangling `serper` reference (which would fail with
  `WEB_PROVIDER_CONFIGURED_MISSING`).

### Install / upgrade

```bash
dsh plugin --profile web add @dingpenghui/dsh-web-search-serper@1.1.0
```

The default endpoint remains `https://google.serper.dev` — **not**
`https://serper.dev`, which is the marketing site and returns 404.
