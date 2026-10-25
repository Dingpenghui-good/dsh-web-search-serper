// 验证「优先 Serper、失败降级」——完整模拟 dsh-web 的 seam 注册表与选择语义
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const key = /SERPER_API_KEY:\s*(\S+)/.exec(
  readFileSync(join(homedir(), '.dsh', '.credentials.yaml'), 'utf8'),
)?.[1]
const mod = await import('file:///E:/dsh-workspace/dsh-web-search-serper/lib/index.js')

let pass = 0
let fail = 0
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? '✅' : '❌'} ${label}${detail === '' ? '' : ` — ${detail}`}`)
  if (ok) pass++
  else fail++
}
const first = (r) => r.sources?.[0]?.title ?? '(空结果)'
const isFallback = (r) => String(first(r)).startsWith('FALLBACK')

/**
 * 最小 seam：registry(Map) + settings + credentials。
 * 复刻 dsh-web 的关键事实——`ctx.get('web').searchProviders` 就是注册表本身。
 */
function makeSeam({ serperConfig = {}, hasKey = true, withFallback = true, fallbackWorks = true } = {}) {
  const deepseek = {
    id: 'deepseek-official',
    available: () => true,
    search: async () => {
      if (!fallbackWorks) throw new Error('deepseek-official 同样不可用')
      return { sources: [{ url: 'https://fallback.example/', title: 'FALLBACK-deepseek-official' }], truncated: false }
    },
  }
  const registry = new Map(withFallback ? [['deepseek-official', deepseek]] : [])
  const settings = { describe: () => [{ ns: 'web-search-serper', value: serperConfig }] }
  const credentials = {
    resolve: async (ref) => (hasKey && ref === 'SERPER_API_KEY' ? { ref, value: key } : undefined),
  }
  const web = { registerSearchProvider: (p) => { registry.set(p.id, p) }, searchProviders: registry }
  const ctx = {
    web,
    get: (n) => (n === 'web' ? web : n === 'settings' ? settings : n === 'credentials' ? credentials : undefined),
  }
  mod.apply(ctx)
  return registry.get('serper')
}

const trySearch = async (p, request = { query: 'DeepSeek Harness', maxResults: 3 }, signal) => {
  try {
    return { ok: true, result: await p.search(request, signal) }
  } catch (e) {
    return { ok: false, error: e }
  }
}

console.log('【1】Serper 配置正常 → 优先走 Serper')
{
  const p = makeSeam({ serperConfig: { baseURL: 'https://google.serper.dev' } })
  check('available() === true', p.available() === true)
  const r = await trySearch(p)
  check('真实 Serper 结果（未降级）', r.ok && !isFallback(r.result), r.ok ? first(r.result) : r.error.message)
}

console.log('\n【2】Serper 端点配错（用户踩过的 https://serper.dev/）→ 自动降级')
{
  const p = makeSeam({ serperConfig: { baseURL: 'https://serper.dev/' } })
  check('available() === true（有降级目标兜底）', p.available() === true)
  const r = await trySearch(p)
  check('降级到 deepseek-official', r.ok && isFallback(r.result), r.ok ? first(r.result) : r.error.message)
}

console.log('\n【3】Serper 无 key → 自动降级（而不是让 web_search 整体不可用）')
{
  const p = makeSeam({ serperConfig: {}, hasKey: false })
  check('available() === true（有降级目标兜底）', p.available() === true)
  const r = await trySearch(p)
  check('降级到 deepseek-official', r.ok && isFallback(r.result), r.ok ? first(r.result) : r.error.message)
}

console.log('\n【4】端点非法 + 无降级目标 → available() 必须为 false')
{
  const p = makeSeam({ serperConfig: { baseURL: 'not a url' }, withFallback: false })
  check('available() === false', p.available() === false)
}

console.log('\n【5】端点非法 + 有降级目标 → available() 放宽为 true，search 走降级')
{
  const p = makeSeam({ serperConfig: { baseURL: 'not a url' }, withFallback: true })
  check('available() === true', p.available() === true)
  const r = await trySearch(p)
  check('降级到 deepseek-official', r.ok && isFallback(r.result), r.ok ? first(r.result) : r.error.message)
}

console.log('\n【6】Serper 挂 + 无降级目标 → 抛 Serper 原始错误')
{
  const p = makeSeam({ serperConfig: { baseURL: 'https://serper.dev/' }, withFallback: false })
  const r = await trySearch(p)
  check('上抛错误', !r.ok)
  check('错误来自 Serper', !r.ok && /Serper search request failed/.test(r.error.message),
    r.ok ? '' : r.error.message.slice(0, 70))
}

console.log('\n【7】两侧都失败 → 错误消息同时体现「主后端先失败」与降级失败')
{
  const p = makeSeam({ serperConfig: { baseURL: 'https://serper.dev/' }, fallbackWorks: false })
  const r = await trySearch(p)
  check('上抛错误', !r.ok)
  check('含 Serper 失败信息', !r.ok && /Serper/.test(r.error.message))
  check('含降级失败信息', !r.ok && /deepseek-official/.test(r.error.message))
  check('cause 链保留降级错误', !r.ok && r.error.cause instanceof Error)
}

console.log('\n【8】用户取消（已中止的 signal）→ 不降级，直接抛 WEB_ABORTED')
{
  const p = makeSeam({ serperConfig: { baseURL: 'https://google.serper.dev' } })
  const ctrl = new AbortController()
  ctrl.abort()
  const r = await trySearch(p, { query: 'DeepSeek Harness', maxResults: 3 }, ctrl.signal)
  check('上抛错误而非返回结果', !r.ok, r.ok ? `(竟返回了 ${first(r.result)})` : '')
  check('错误码为 WEB_ABORTED', !r.ok && r.error.code === 'WEB_ABORTED', r.ok ? '' : `code=${r.error.code}`)
}

console.log(`\n结果：${pass} 通过 / ${fail} 失败`)
process.exit(fail === 0 ? 0 : 1)
