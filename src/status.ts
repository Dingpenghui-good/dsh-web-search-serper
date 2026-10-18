/**
 * 运行时可观测状态：记录本 provider 最近一次被调用的情况。
 *
 * 存在理由（实战教训）：插件「已安装且已配置」不等于「已生效」。
 * DSH 的 profile 配置（`cordis.patch.yml`）是**进程启动时读取**的，改动后
 * 不重启不会重载插件层；再加上 provider 被 seam 静默接管，调用方无从判断
 * 一次 `web_search` 到底走了 Serper 还是内置后端。真实案例见 RELEASE_NOTES_v1.2.7。
 *
 * 因此这里记录可被设置页读取的最小事实集：
 * - 本 provider 当前是否被 `web.searchProvider` 选中；
 * - 最近一次搜索走了哪个后端、用时、失败原因；
 * - key 的来源（config / env / credential），便于排查「配了却没生效」。
 *
 * 所有字段只读快照，不含 key 值本身（只有来源枚举），可安全展示。
 */

/** key 的实际来源；用于区分「配置里的 key」与「凭据库里的 key」。 */
export type SerperKeySource = 'config' | 'env' | 'credential' | 'missing'

/** 最近一次搜索的结果形态。 */
export type SerperLastOutcome =
  /** 走 Serper 成功。 */
  | 'serper-ok'
  /** Serper 失败，降级后端成功。 */
  | 'fallback-ok'
  /** Serper 与降级后端都失败。 */
  | 'failed'
  /** 用户取消，未降级。 */
  | 'aborted'

/** 最近一次搜索的可展示摘要。 */
export interface SerperLastSearch {
  /** 结果形态。 */
  readonly outcome: SerperLastOutcome
  /** 实际承载本次结果的 provider id（失败时为 Serper 自己的 id）。 */
  readonly servedBy: string
  /** 开始时间（epoch ms）。 */
  readonly at: number
  /** 耗时（ms）。 */
  readonly durationMs: number
  /** 失败原因（截断后的简短文本）；成功时缺省。 */
  readonly error?: string
  /** 本次调用解析到的 key 来源。 */
  readonly keySource: SerperKeySource
}

/** 插件运行状态快照。 */
export interface SerperRuntimeStatus {
  /** 插件模块是否已 apply（注册到 seam）。 */
  readonly registered: boolean
  /** 本进程内累计调用次数。 */
  readonly calls: number
  /** 其中走 Serper 成功的次数。 */
  readonly serperHits: number
  /** 其中发生降级的次数。 */
  readonly fallbacks: number
  /** 最近一次搜索。 */
  readonly last?: SerperLastSearch
}

/** 错误文本截断长度：避免把整段上游 HTML 塞进状态。 */
const ERROR_SNIPPET_MAX = 300

/**
 * 把错误归约为一行可读文本。
 * @param error - 任意抛出值。
 * @returns 截断后的文本。
 */
function snippet(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error)
  return text.length > ERROR_SNIPPET_MAX ? `${text.slice(0, ERROR_SNIPPET_MAX)}…` : text
}

/** 进程内累积状态；由 provider 写入、设置页读取。 */
export class SerperStatusTracker {
  private registered = false
  private calls = 0
  private serperHits = 0
  private fallbacks = 0
  private last: SerperLastSearch | undefined
  private onFallback: ((servedBy: string, reason: string) => void) | undefined
  private onFailure: ((reason: string) => void) | undefined

  /**
   * 绑定通知回调（宿主 logger 就绪后由 apply 调用；可重复调用覆盖旧回调）。
   * @param onFallback - 降级发生时通知。
   * @param onFailure - 两侧都失败时通知。
   */
  setHooks(
    onFallback?: (servedBy: string, reason: string) => void,
    onFailure?: (reason: string) => void,
  ): void {
    this.onFallback = onFallback
    this.onFailure = onFailure
  }

  /** 标记插件已注册到 seam。 */
  markRegistered(): void {
    this.registered = true
  }

  /**
   * 记录一次搜索结束。
   * @param entry - 不含累计计数的单次结果。
   */
  record(entry: Omit<SerperLastSearch, 'at' | 'durationMs'> & { at: number; durationMs: number }): void {
    this.calls += 1
    if (entry.outcome === 'serper-ok') this.serperHits += 1
    if (entry.outcome === 'fallback-ok') {
      this.fallbacks += 1
      this.onFallback?.(entry.servedBy, entry.error ?? 'unknown reason')
    }
    if (entry.outcome === 'failed') this.onFailure?.(entry.error ?? 'unknown reason')
    this.last = { ...entry, error: entry.error === undefined ? undefined : snippet(entry.error) }
  }

  // 注意：不使用 TS 参数属性 / 私有字段语法糖之外的运行时特性，保持与 target 一致。
  /**
   * 读取不可变快照。
   * @returns 当前状态。
   */
  snapshot(): SerperRuntimeStatus {
    return {
      registered: this.registered,
      calls: this.calls,
      serperHits: this.serperHits,
      fallbacks: this.fallbacks,
      ...(this.last === undefined ? {} : { last: this.last }),
    }
  }
}
