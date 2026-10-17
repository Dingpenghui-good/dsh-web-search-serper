# 发布说明 v1.2.1

**日期：** 2026-10-17

> ⚠️ **本版本未发布到 npm。** 它把目标运行时定位为 DSH `0.2.1-rc.1`，但该版本线的
> 客户端公共包（`dsh-client-ui-slots` / `dsh-client-store` /
> `dsh-client-ui-primitives`）既不在安装包内、也未发布到 npm，无法取得类型或运行时
> 依赖。源码随后回退为面向 `0.2.0-rc.2`，并以 **1.2.2** 发布。
>
> 保留本文件仅用于追溯：`package.json` 的 `files` 中列有它，但 npm 上不存在
> 1.2.1 这个版本。

## 内容（相对 1.2.0）

- 客户端 slot 注册改为 `plugins.bundle.config` / `plugins.row.config` 双注册，
  经 `configForms.whileServed` 跟随命名空间是否被 serve。
- Host 配置读取解包 `volatile()` 的 `{ get() }` 包装（与宿主 `plainConfig` 同语义）。
- 错误类改为在包内承载 `HarnessError` 形状。

## 为什么没有发布

0.2.1-rc.1 缺少可用的客户端公共包；若强行发布，安装后会得到无法加载的客户端半边。
