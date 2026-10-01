# @dingpenghui/dsh-web-search-serper v1.0.1

npm 版本与 git tag 的对齐版本。**无功能性变更**：`lib/` 产物与 1.0.0 一致。

## 中文

### 为什么发 1.0.1

1.0.0 的代码（含把包名改回 scoped 的提交 `7836949`）已经发布到 npm，但 git tag
`v1.0.0` 仍指向改名**之前**的提交 `801dce6`。也就是说 `git checkout v1.0.0` 拿到的
是**无 scope 的包名** `dsh-web-search-serper` —— 那个名字在 npm 上属于其他作者
（risyasin），既无法发布也无法安装。

移动一个已经发布过 Release 的 tag 等于改写公开历史，因此改为发布 1.0.1：
tag `v1.0.1` 与 npm `1.0.1` 指向同一份代码。

### 变更

- 无功能性变更；与 1.0.0 的构建产物一致
- 仓库清理：删除 0.3.1 时代遗留的 `RELEASE_NOTES.md` 与
  `dingpenghui-dsh-web-search-serper-0.3.1.tgz`

### 安装

```bash
dsh plugin --profile web add @dingpenghui/dsh-web-search-serper@1.0.1
```

`1.0.0` 与 `1.0.1` 在 npm 上内容等价，装哪个都可以；建议用 `1.0.1` 以便与 tag 对齐。

---

## English

Version that re-aligns the npm release with a git tag. **No functional change**:
the `lib/` output is identical to 1.0.0.

### Why 1.0.1

The 1.0.0 code — including commit `7836949`, which renamed the package back to the
scoped name — was already published to npm, but git tag `v1.0.0` still points at
`801dce6`, the commit *before* the rename. So `git checkout v1.0.0` yields the
**unscoped** name `dsh-web-search-serper`, which on npm belongs to another author
(risyasin): it can be neither published nor installed.

Moving a tag that already backs a published Release would rewrite public history,
so 1.0.1 is released instead: tag `v1.0.1` and npm `1.0.1` point at the same code.

### Changes

- No functional change; the build output matches 1.0.0
- Repository cleanup: removed the leftover `RELEASE_NOTES.md` and
  `dingpenghui-dsh-web-search-serper-0.3.1.tgz` from the 0.3.1 era

### Install

```bash
dsh plugin --profile web add @dingpenghui/dsh-web-search-serper@1.0.1
```

`1.0.0` and `1.0.1` are equivalent on npm; prefer `1.0.1` so the installed version
matches the git tag.
