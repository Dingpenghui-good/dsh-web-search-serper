// 验证 profile 中「已安装」的包（不是工作区源码）在 DSH 0.2.1-rc.2 运行时下的真实行为。
// 关键点：用一个带标记的本地回环端点替代 Serper，证明搜索确实经过本插件的 provider，
// 而不是被 seam 直接选中了 dsh-base 自带的 provider。
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'node:http'

const root = join(homedir(), '.dsh', 'profiles', 'desktop', 'node_modules', '@dingpenghui', 'dsh-web-search-serper')
const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8').replace(/^\uFEFF/, ''))
const credentialsRaw = readFileSync(join(homedir(), '.dsh', '.credentials.yaml'), 'utf8')
const key = /SERPER_API_KEY:\s*(\S+)/.exec(credentialsRaw)?.[1]

const mod = await import(`file:///${join(root, 'lib', 'index.js').replace(/\\/g, '/')}`)
console.log(`已安装包: ${manifest.name}@${manifest.version}`)
console.log(`兼容声明: engines.dsh = ${manifest.engines?.dsh}`)

let pass = 0
let fail = 0
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'} ${label}${detail ? ' — ' + detail : ''}`)
  ok ? pass++ : fail++
}

// 假的 Serper 端点：回带可识别的标记，证明请求确实打到了本插件
let hits = 0
let lastAuth = null
const server = createServer((req, res) => {
  let body = ''
  req.on('data', (c) => { body += c })
  req.on('end', () => {
    hits++
    lastAuth = req.headers['x-api-key'] ?? null
    const q = JSON.parse(body || '{}').q ?? ''
    res.setHeader('content-type', 'application/json')
    if (q === 'force fail') {
      res.statusCode = 500
      res.end(JSON.stringify({ message: 'synthetic upstream failure' }))
      return
    }
    res.end(JSON.stringify({
      organic: [
        { title: 'SERPER-MARKER', link: 'https://serper-marked.example/', snippet: 'served by serper path' },
        { title: 'second', link: 'https://second.example/' },
        { title: 'linkless' },
      ],
    }))
  })
})
await new Promise((d) => server.listen(0, '127.0.0.1', d))
const port = server.address().port

function makeSeam({ serperConfig, withFallback = true, withKey = true }) {
  // 每次都用全新的注册表：复用旧表会导致 map.set 覆盖后仍持有上一轮 apply 注册的
  // provider 实例，测到的就不是本轮配置（取消测试会因此打到上一轮的端点）。
  const fallback = {
    id: 'deepseek-official',
    available: () => true,
    search: async () => ({ sources: [{ url: 'https://fallback.example/', title: 'FALLBACK' }], truncated: false }),
  }
  const registry = new Map(withFallback ? [['deepseek-official', fallback]] : [])
  const settings = { describe: () => [{ ns: 'web-search-serper', value: serperConfig }] }
  const credentials = { resolve: async (ref) => (withKey && ref === 'SERPER_API_KEY' ? { ref, value: key } : undefined) }
  const web = {
    registerSearchProvider: (p) => { registry.set(p.id, p); return () => registry.delete(p.id) },
    searchProviders: registry,
  }
  mod.apply({
    web,
    get: (n) => (n === 'web' ? web : n === 'settings' ? settings : n === 'credentials' ? credentials : undefined),
  })
  return { registry, provider: registry.get('serper') }
}

try {
  console.log('\n[1] 端点指向本地假 Serper → 必须真的走 Serper 路径')
  {
    const { provider } = makeSeam({ serperConfig: { baseURL: `http://127.0.0.1:${port}`, apiKey: 'probe-key' } })
    check('serper provider 已注册到 ctx.web', provider !== undefined)
    check('provider.available() 为 true', provider?.available() === true)
    const r = await provider.search({ query: 'marker test', maxResults: 2 })
    check('请求打到了 Serper 端点（本地计数 > 0）', hits > 0, `hits=${hits}`)
    check('携带了 X-Api-Key', lastAuth === 'probe-key', `auth=${lastAuth}`)
    check('结果来自 Serper 而非降级', r.sources[0]?.title === 'SERPER-MARKER', r.sources[0]?.title)
    check('seam 语义：maxResults 生效', r.sources.length === 2, `len=${r.sources.length}`)
    check('丢弃无 link 的条目', r.sources.every((s) => typeof s.url === 'string' && s.url.length > 0))
  }

  console.log('\n[2] Serper 上游 500 → 自动降级到另一个可用 provider')
  {
    const { provider } = makeSeam({ serperConfig: { baseURL: `http://127.0.0.1:${port}`, apiKey: 'probe-key' } })
    const r = await provider.search({ query: 'force fail' })
    check('降级到 deepseek-official', r.sources[0]?.title === 'FALLBACK', r.sources[0]?.title)
  }

  console.log('\n[3] 无 key 且无可用降级目标 → 抛 WEB_PROVIDER_CONFIGURED_UNAVAILABLE')
  {
    const { provider } = makeSeam({ serperConfig: {}, withFallback: false, withKey: false })
    try {
      await provider.search({ query: 'no key' })
      check('应抛错', false)
    } catch (error) {
      check('错误码可路由', error.code === 'WEB_PROVIDER_CONFIGURED_UNAVAILABLE', error.code)
    }
  }

  console.log('\n[4] 用真实凭据打真实 Serper API')
  {
    if (key === undefined) {
      check('跳过：未找到 SERPER_API_KEY', true)
    } else {
      const { provider } = makeSeam({ serperConfig: {} })
      const r = await provider.search({ query: 'DeepSeek Harness', maxResults: 3 })
      check('返回真实结果且带 url', r.sources.length > 0 && r.sources.every((s) => s.url.startsWith('http')),
        `${r.sources.length} 条，首条：${r.sources[0]?.title}`)
      check('未降级', r.sources[0]?.title !== 'FALLBACK')
    }
  }

  console.log('\n[5] 取消信号不触发降级')
  {
    const { provider } = makeSeam({ serperConfig: { baseURL: `http://127.0.0.1:${port}`, apiKey: 'probe-key' } })
    const ac = new AbortController()
    ac.abort()
    try {
      // 注意签名：search(request, signal) 是两个参数，signal 不在 request 里。
      const r = await provider.search({ query: 'cancel' }, ac.signal)
      check('应抛 WEB_ABORTED', false, `resolved with ${JSON.stringify(r).slice(0, 120)}`)
    } catch (error) {
      check('取消映射为 WEB_ABORTED 且不降级', error.code === 'WEB_ABORTED',
        `code=${error.code} name=${error.name} ctor=${error.constructor?.name} msg=${error.message}`)
    }
  }
} finally {
  await new Promise((d) => server.close(d))
}

console.log(`\n结果：${pass} 通过 / ${fail} 失败`)
process.exit(fail === 0 ? 0 : 1)
