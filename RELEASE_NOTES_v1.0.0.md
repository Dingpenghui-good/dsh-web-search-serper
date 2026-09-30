# dsh-web-search-serper v1.0.0

## 中文

### 主要变更

1. **迁移到当前版本插件模型（0.2.0-rc.2）**
   - 依赖升级：`@deepseek-ai/dsh-web` → `0.2.0-rc.2`、`@deepseek-ai/cordis` → `^4.0.4`、新增 `@deepseek-ai/schemastery`（Config schema 支持）
   - 包名改为无 scope 的 `dsh-web-search-serper`（本地 bundle 安装模式，与 dsh-obsidian-sync 一致）
   - 新增 `dsh.bundle`（`cordis.patch.yml` 自动作为 bundle patch 应用）与 `dsh.client`（client 端装配）声明

2. **惰性配置解析（保存后无需重启即生效）**
   - 0.2.0-rc.2 的 settings 保存不会重激活插件 fiber，因此 API Key / 端点 / 地区等配置全部惰性读取：每次搜索时按 `config.apiKey → 环境变量 $SERPER_API_KEY → 凭证库 SERPER_API_KEY 引用` 顺序实时解析
   - 在详情页保存新 Key 后，对后续搜索即时生效，无需重启

3. **新增插件详情页（client 端）**
   - 注册 `plugins.bundle.config` / `plugins.row.config` slot：点插件名即打开「Serper 搜索设置」表单（API Key / 端点基址 / gl / cr / 结果数量），带保存控件
   - 首次安装/更新后需重启一次 DSH 才能打开表单（设置服务尚未就绪），页面会给出明确提示

4. **配套工程**
   - 双 target tsdown 构建（宿主 ESM + client CJS `__ModuleLoader__` 包装）
   - `smoke-test.mjs` 契约测试：宿主导出、Loader 同款 `z.resolve` schema 解析、client bundle 形态
   - typecheck / build / test 全绿

### 安装

```bash
# 作为 profile bundle（推荐）
# 1. profile 的 package.json `dependencies` 加：
#    "dsh-web-search-serper": "link:<本目录绝对路径>"
# 2. 同步 `dsh.profile.bundles` 加 "dsh-web-search-serper"
# 3. 重启 DSH 桌面端
```

或手动在 profile 的 `cordis.patch.yml` 加：

```yaml
- insert:
    - id: web-search-serper
      name: 'dsh-web-search-serper'
```

重启 DSH 后生效；如需固定使用 Serper 作为搜索后端，再把 `web` 的 `searchProvider` 设为 `serper`。

### 破坏性变更

- 包名从 `@dingpenghui/dsh-web-search-serper` 改为 `dsh-web-search-serper`（0.1.x/0.3.x 的安装方式不再适用）
- 仅支持 DSH 0.2.0-rc.x 运行时；旧版本宿主请继续使用 0.3.x 系列

---

## English

### Key changes

1. **Migrated to the current plugin model (0.2.0-rc.2)**
   - Dependencies: `@deepseek-ai/dsh-web` → `0.2.0-rc.2`, `@deepseek-ai/cordis` → `^4.0.4`, new `@deepseek-ai/schemastery` (Config schema support)
   - Package renamed to unscoped `dsh-web-search-serper` (local bundle install model, same as dsh-obsidian-sync)
   - New `dsh.bundle` (`cordis.patch.yml` applied automatically as the bundle patch) and `dsh.client` (client-side assembly) declarations

2. **Lazy config resolution (applies without restart after save)**
   - Since 0.2.0-rc.2 settings saves do not re-activate plugin fibers, all config values (API key / endpoint / region) are read lazily: each search resolves in the order `config.apiKey → $SERPER_API_KEY env var → SERPER_API_KEY credential reference`
   - Saving a new key on the detail page takes effect for subsequent searches immediately, no restart needed

3. **New plugin detail page (client side)**
   - Registers `plugins.bundle.config` / `plugins.row.config` slots: clicking the plugin name opens the "Serper search settings" form (API key / endpoint base URL / gl / cr / result count) with save controls
   - After first install/upgrade, DSH must be restarted once for the form to become available (settings service not yet ready); the page shows an explicit hint

4. **Engineering**
   - Dual-target tsdown build (host ESM + client CJS `__ModuleLoader__` wrapper)
   - `smoke-test.mjs` contract tests: host exports, Loader-style `z.resolve` schema parsing, client bundle shape
   - typecheck / build / test all green

### Installation

```bash
# As a profile bundle (recommended)
# 1. Add to the profile's package.json "dependencies":
#    "dsh-web-search-serper": "link:<absolute path to this dir>"
# 2. Add "dsh-web-search-serper" to "dsh.profile.bundles"
# 3. Restart the DSH desktop app
```

Or manually add to the profile's `cordis.patch.yml`:

```yaml
- insert:
    - id: web-search-serper
      name: 'dsh-web-search-serper'
```

Takes effect after restarting DSH; to pin Serper as the search backend, set the `web` service's `searchProvider` to `serper`.

### Breaking changes

- Package renamed from `@dingpenghui/dsh-web-search-serper` to `dsh-web-search-serper` (0.1.x/0.3.x install flows no longer apply)
- Requires the DSH 0.2.0-rc.x runtime; keep using the 0.3.x series on older hosts
