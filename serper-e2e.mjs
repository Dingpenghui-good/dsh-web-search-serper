// 端到端验证：加载 profile 实际安装的插件包，按 apply() 的真实路径跑搜索
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const key = /SERPER_API_KEY:\s*(\S+)/.exec(
  readFileSync(join(homedir(), '.dsh', '.credentials.yaml'), 'utf8'),
)?.[1]
if (!key) { console.log('凭据库缺少 SERPER_API_KEY'); process.exit(1) }

const pkg = join(homedir(), '.dsh', 'profiles', 'desktop', 'node_modules',
  '@dingpenghui', 'dsh-web-search-serper', 'lib', 'index.js')
const mod = await import(`file:///${pkg.replace(/\\/g, '/')}`)
console.log(`插件包: ${pkg}`)
console.log(`导出 provider id: ${mod.SERPER_PROVIDER_ID} | 默认端点: ${mod.SERPER_DEFAULT_BASE_URL}`)

async function run(label, config) {
  let p
  const ctx = {
    web: { registerSearchProvider: (x) => { p = x } },
    get: (name) => {
      if (name === 'settings') return { describe: () => [{ ns: 'web-search-serper', value: config }] }
      if (name === 'credentials') {
        return { resolve: async (ref) => (ref === 'SERPER_API_KEY' ? { ref, value: key } : undefined) }
      }
      return undefined
    },
  }
  mod.apply(ctx, undefined)
  console.log(`\n[${label}]`)
  console.log(`  available() = ${p.available()}`)
  const t0 = Date.now()
  try {
    const r = await p.search({ query: 'DeepSeek Harness', maxResults: 3 })
    console.log(`  结果 OK  ${Date.now() - t0}ms  ${r.sources.length} 条`)
    console.log(`    首条: ${r.sources[0]?.title}`)
    console.log(`    URL : ${r.sources[0]?.url}`)
  } catch (e) {
    console.log(`  失败  ${Date.now() - t0}ms  ${e.constructor.name}`)
    console.log(`    code=${e.code ?? '(无)'}`)
    console.log(`    msg =${e.message}`)
  }
}

// 场景 A：desktop/cordis.patch.yml 里写的现状配置
await run('场景A — 当前 profile 配置', { apiKey: key, baseURL: 'https://serper.dev/' })
// 场景 B：把 baseURL 修正为官方 API 端点
await run('场景B — 修正端点后', { apiKey: key, baseURL: 'https://google.serper.dev' })
