// 验证 profile 中「已安装的」那个包（而不是工作区源码）——确认 npm 上的 1.1.0 可用
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const root = join(homedir(), '.dsh', 'profiles', 'desktop', 'node_modules', '@dingpenghui', 'dsh-web-search-serper')
const pj = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const key = /SERPER_API_KEY:\s*(\S+)/.exec(readFileSync(join(homedir(), '.dsh', '.credentials.yaml'), 'utf8'))?.[1]

const mod = await import(`file:///${join(root, 'lib', 'index.js').replace(/\\/g, '/')}`)
console.log(`已安装包: ${pj.name}@${pj.version}`)

let pass = 0, fail = 0
const check = (l, ok, d = '') => { console.log(`  ${ok ? '✅' : '❌'} ${l}${d ? ' — ' + d : ''}`); ok ? pass++ : fail++ }

function makeSeam({ serperConfig = {}, hasKey = true, withFallback = true } = {}) {
  const deepseek = {
    id: 'deepseek-official',
    available: () => true,
    search: async () => ({ sources: [{ url: 'https://fallback.example/', title: 'FALLBACK-deepseek-official' }], truncated: false }),
  }
  const registry = new Map(withFallback ? [['deepseek-official', deepseek]] : [])
  const settings = { describe: () => [{ ns: 'web-search-serper', value: serperConfig }] }
  const credentials = { resolve: async (ref) => (hasKey && ref === 'SERPER_API_KEY' ? { ref, value: key } : undefined) }
  const web = { registerSearchProvider: (p) => { registry.set(p.id, p) }, searchProviders: registry }
  mod.apply({ web, get: (n) => (n === 'web' ? web : n === 'settings' ? settings : n === 'credentials' ? credentials : undefined) })
  return registry.get('serper')
}

const run = async (p) => {
  try { return { ok: true, r: await p.search({ query: 'DeepSeek Harness', maxResults: 3 }) } }
  catch (e) { return { ok: false, e } }
}
const first = (r) => r.sources?.[0]?.title ?? '(空)'

console.log('\n[1] 正常配置 → 优先 Serper')
{
  const p = makeSeam({ serperConfig: { baseURL: 'https://google.serper.dev' } })
  const { ok, r, e } = await run(p)
  check('返回 Serper 结果', ok && !first(r).startsWith('FALLBACK'), ok ? first(r) : e.message)
}
console.log('\n[2] 端点配错 → 降级（1.1.0 的核心能力）')
{
  const p = makeSeam({ serperConfig: { baseURL: 'https://serper.dev/' } })
  const { ok, r, e } = await run(p)
  check('降级到 deepseek-official', ok && first(r).startsWith('FALLBACK'), ok ? first(r) : e.message)
}
console.log('\n[3] 无 key → 降级')
{
  const p = makeSeam({ serperConfig: {}, hasKey: false })
  const { ok, r, e } = await run(p)
  check('降级到 deepseek-official', ok && first(r).startsWith('FALLBACK'), ok ? first(r) : e.message)
}
console.log(`\n结果：${pass} 通过 / ${fail} 失败`)
process.exit(fail === 0 ? 0 : 1)
