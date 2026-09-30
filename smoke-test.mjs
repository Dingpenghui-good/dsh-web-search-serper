/**
 * 构建产物契约 smoke test（node 直接执行，无需 vitest）：
 *   - lib/index.js 可被 ESM 加载；导出 name/inject/apply/ConfigSchema
 *   - inject 含 web；name 为 web-search-serper
 *   - ConfigSchema 可被 Loader 同款 z.resolve(data, schema) 解析
 *   - lib/client.js 是 window.__ModuleLoader__ bundle，含 slot 注册与 locale 命名空间
 *
 * 用法：pnpm run test（在仓库根）
 */
import { readFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import assert from 'node:assert/strict'

const root = dirname(fileURLToPath(import.meta.url))
const libIndex = resolve(root, 'lib/index.js')
const libClient = resolve(root, 'lib/client.js')

assert.ok(existsSync(libIndex), 'lib/index.js exists (run pnpm build first)')

const z = (await import('@deepseek-ai/schemastery')).default
const mod = await import(pathToFileURL(libIndex).href)

// 插件元数据
assert.equal(mod.name, 'web-search-serper', 'plugin name')
assert.deepEqual([...mod.inject], ['web'], 'injects web service')
assert.equal(typeof mod.apply, 'function', 'apply exported')
assert.equal(mod.SERPER_PROVIDER_ID, 'serper', 'provider id')

// Loader 同款解析（z.resolve(data, schema)）
const [out] = z.resolve({}, mod.ConfigSchema)
assert.ok(out && typeof out === 'object', 'empty config resolves to object')
assert.ok(out.apiKey !== undefined, 'empty config materializes all fields')
const [out2] = z.resolve({ apiKey: 'k', gl: 'cn', numResults: 5 }, mod.ConfigSchema)
assert.ok(out2 && out2.apiKey !== undefined, 'partial config parses')

// client bundle 形态
const clientSrc = readFileSync(libClient, 'utf8')
assert.ok(clientSrc.startsWith('window.__ModuleLoader__.load'), 'client bundle bootstraps via __ModuleLoader__')
assert.ok(clientSrc.includes('plugins.bundle.config'), 'registers plugins.bundle.config slot')
assert.ok(clientSrc.includes('plugins.row.config'), 'registers plugins.row.config slot')
assert.ok(clientSrc.includes('settings.dsh-web-search-serper'), 'locale namespace registered')
assert.ok(clientSrc.includes('web-search-serper'), 'settings namespace key')

console.log('✓ all serper plugin contract checks passed')
