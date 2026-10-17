/**
 * 构建产物契约 smoke test（node 直接执行，无需 vitest）：
 *   1. Host 半边：lib/index.js 可被 ESM 加载；导出 name/inject/apply/Config；
 *      `Config` 可被 Loader 同款 `z.resolve(data, schema)` 解析；
 *      能在一个最小 Context 上完成 search provider 注册与真实 HTTP 搜索映射。
 *   2. Client 半边：lib/client.js 是 `window.__ModuleLoader__` 工厂形态，
 *      且只 require 宿主模块表里一定有的两个说明符。
 *
 * 用法：`pnpm run test`（先 `pnpm run build`）。
 */
import { readFileSync, existsSync } from 'node:fs'
import { createServer } from 'node:http'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import assert from 'node:assert/strict'

const root = dirname(fileURLToPath(import.meta.url))
const libIndex = resolve(root, 'lib/index.js')
const libClient = resolve(root, 'lib/client.js')

assert.ok(existsSync(libIndex), 'lib/index.js exists (run pnpm build first)')
assert.ok(existsSync(libClient), 'lib/client.js exists (run pnpm build first)')

const z = (await import('@deepseek-ai/schemastery')).default
const mod = await import(pathToFileURL(libIndex).href)

// 插件元数据
assert.equal(mod.name, 'web-search-serper', 'plugin name')
assert.deepEqual([...mod.inject], ['web'], 'injects web service')
assert.equal(typeof mod.apply, 'function', 'apply exported')
assert.equal(mod.SERPER_PROVIDER_ID, 'serper', 'provider id')
assert.equal(mod.SERPER_DEFAULT_BASE_URL, 'https://google.serper.dev', 'default endpoint')

// Loader 同款解析（z.resolve(data, schema)）。
// volatile 字段在解析结果里是 { get(): T } 包装，这里按宿主 plainConfig 的语义解包。
const unwrap = (value) => (value !== null && typeof value === 'object' && typeof value.get === 'function'
  ? value.get()
  : value)

const [out] = z.resolve({}, mod.Config)
assert.ok(out && typeof out === 'object', 'empty config resolves to an object')
const [out2] = z.resolve({ apiKey: 'k', gl: 'cn', numResults: 5 }, mod.Config)
assert.equal(unwrap(out2.apiKey), 'k')
assert.equal(unwrap(out2.gl), 'cn')
assert.equal(unwrap(out2.numResults), 5)
assert.throws(
  () => z.resolve({ numResults: 500 }, mod.Config),
  /numResults/,
  'numResults above 100 is rejected by the schema',
)

// 注册面：最小 Context（只提供本插件用到的 web / settings / credentials）
function makeContext({ searchProviders = new Map(), settings, credentials } = {}) {
  const services = {
    web: {
      searchProviders,
      registerSearchProvider(provider) {
        searchProviders.set(provider.id, provider)
        return () => searchProviders.delete(provider.id)
      },
    },
  }
  if (settings !== undefined) services.settings = settings
  if (credentials !== undefined) services.credentials = credentials
  return {
    web: services.web,
    get(name) { return services[name] },
  }
}

const fallbackCalls = []
const fallbackProvider = {
  id: 'deepseek-official',
  available: () => true,
  search: async (request) => {
    fallbackCalls.push(request.query)
    if (request.query === 'fallback please' || request.query === 'rate limited') {
      return { sources: [{ url: 'https://fallback.example/' }], truncated: false }
    }
    throw new Error('fallback unavailable too')
  },
}

const registry = new Map([['deepseek-official', fallbackProvider]])
const ctx = makeContext({ searchProviders: registry })
mod.apply(ctx)
const provider = registry.get('serper')
assert.ok(provider !== undefined, 'serper provider registered on ctx.web')
assert.equal(provider.available(), true, 'provider is usable when the key resolves')

// 行 config 经由 ctx.settings.describe() 惰性读取。volatile 字段在解析值里是
// { get() } 包装，宿主展示层同样会解包，这里两种形态各测一遍。
let rowConfig = {}
let wrapped = false
const settings = {
  describe: () => [{
    ns: 'web-search-serper',
    value: wrapped ? Object.fromEntries(Object.entries(rowConfig).map(([k, v]) => [k, { get: () => v }])) : rowConfig,
  }],
}
// 与 provider 同一个注册表，使「Serper 失败 → 降级」链在真实 seam 语义下可测。
const ctx2 = makeContext({ searchProviders: registry, settings, credentials: undefined })
mod.apply(ctx2)
const provider2 = registry.get('serper')

// 真实 HTTP 搜索（本地回环 server，验证映射与错误分类）
let seen
const server = createServer((req, res) => {
  let body = ''
  req.on('data', (chunk) => { body += chunk })
  req.on('end', () => {
    seen = { url: req.url, key: req.headers['x-api-key'], body: JSON.parse(body) }
    res.setHeader('content-type', 'application/json')
    if (JSON.parse(body).q === 'rate limited') {
      res.statusCode = 429
      res.end(JSON.stringify({ message: 'quota exhausted' }))
      return
    }
    res.end(JSON.stringify({
      organic: [
        { title: 'A', link: 'https://a.example/', snippet: 'first' },
        { title: 'no link' },
        { title: 'B', link: 'https://b.example/' },
      ],
    }))
  })
})
await new Promise((done) => server.listen(0, '127.0.0.1', done))
const port = server.address().port
try {
  rowConfig = { apiKey: 'test-key', baseURL: `http://127.0.0.1:${port}/`, gl: 'cn', numResults: 3 }
  const result = await provider2.search({ query: 'dsh serper' })
  assert.deepEqual(result.sources, [
    { url: 'https://a.example/', title: 'A', snippet: 'first' },
    { url: 'https://b.example/', title: 'B' },
  ], 'organic results map to sources; link-less entries drop')
  assert.equal(result.truncated, false)
  assert.equal(seen.url, '/search', 'endpoint joins without a double slash')
  assert.equal(seen.key, 'test-key', 'X-Api-Key header carries the resolved key')
  assert.deepEqual(seen.body, { q: 'dsh serper', gl: 'cn', num: 3 }, 'request body carries gl/num')

  // 429：Serper 侧失败 → 回退到另一注册 provider
  const degraded = await provider2.search({ query: 'rate limited' })
  assert.deepEqual(degraded.sources.map((s) => s.url), ['https://fallback.example/'], 'falls back on a 429')
  assert.deepEqual(fallbackCalls, ['rate limited'], 'the failing query reached the fallback')

  // 取消不降级
  const aborter = new AbortController()
  aborter.abort()
  await assert.rejects(
    () => provider2.search({ query: 'cancel me' }, aborter.signal),
    (error) => error.code === 'WEB_ABORTED',
    'cancellation surfaces as WEB_ABORTED',
  )
  assert.deepEqual(fallbackCalls, ['rate limited'], 'cancellation does not fall back')

  // volatile 包装形态的 config 同样被解包（宿主 describe() 的真实形态）
  wrapped = true
  rowConfig = { apiKey: 'wrapped-key', baseURL: `http://127.0.0.1:${port}`, numResults: 7 }
  const wrappedResult = await provider2.search({ query: 'volatile config' })
  assert.equal(wrappedResult.sources.length, 2, 'volatile-wrapped config still searches')
  assert.equal(seen.key, 'wrapped-key', 'volatile apiKey unwraps')
  assert.deepEqual(seen.body, { q: 'volatile config', num: 7 }, 'volatile numResults unwraps')
  wrapped = false

  // 无 key → WEB_PROVIDER_CONFIGURED_UNAVAILABLE，并降级
  delete process.env.SERPER_API_KEY
  rowConfig = {}
  const noKey = await provider2.search({ query: 'fallback please' })
  assert.deepEqual(noKey.sources.map((s) => s.url), ['https://fallback.example/'], 'missing key still degrades')
} finally {
  await new Promise((done) => server.close(done))
}

// client bundle 形态
const clientSrc = readFileSync(libClient, 'utf8')
assert.ok(clientSrc.startsWith('window.__ModuleLoader__.load'), 'client bundle bootstraps via __ModuleLoader__')
assert.ok(clientSrc.includes('"@dingpenghui/dsh-web-search-serper"'), 'client bundle registers under the package id')
assert.ok(clientSrc.includes('plugins.bundle.config'), 'registers plugins.bundle.config slot')
assert.ok(clientSrc.includes('plugins.row.config'), 'registers plugins.row.config slot')
assert.ok(clientSrc.includes('settings.dsh-web-search-serper'), 'locale namespace registered')
assert.ok(clientSrc.includes('whileServed'), 'page follows the served settings namespace')

// 0.2.0-rc.2 的模块表里只有平台种子（react / react-dom）与被请求的包；
// 其余一切必须内联，否则 require 会在运行时抛错。
const SEED_OR_PLATFORM = new Set([
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-store',
])
const required = [...new Set([...clientSrc.matchAll(/require\("([^"]+)"\)/g)].map((match) => match[1]))]
for (const specifier of required) {
  assert.ok(
    SEED_OR_PLATFORM.has(specifier),
    `client bundle must only require module-table specifiers, saw ${specifier}`,
  )
}
assert.ok(required.includes('@deepseek-ai/dsh-client-ui-primitives'), 'primitives come from the module table, not an inline copy')

console.log('OK all serper plugin contract checks passed')
