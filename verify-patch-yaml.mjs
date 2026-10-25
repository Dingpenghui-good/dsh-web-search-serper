// 校验插件自带 cordis.patch.yml 的 YAML 结构与接管行内容
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const yaml = require('C:/Users/dph/.dsh/profiles/node_modules/js-yaml/index.js')
const path = 'E:/dsh-workspace/dsh-web-search-serper/cordis.patch.yml'
const doc = yaml.load(readFileSync(path, 'utf8'))

console.log('顶层是数组:', Array.isArray(doc))
console.log('条目数:', doc.length)

const webRow = doc.find((r) => r?.id === 'web')
const insertBlock = doc.find((r) => r?.insert !== undefined)
const inserted = insertBlock?.insert ?? []

console.log('\n[接管行] - id: web')
console.log('  存在:', webRow !== undefined)
console.log('  name:', webRow?.name)
console.log('  config:', JSON.stringify(webRow?.config))
console.log('  searchProvider 指向本插件:', webRow?.config?.searchProvider === 'serper')
console.log('  fetchProvider 已重述:', webRow?.config?.fetchProvider === 'http')

console.log('\n[插入行] - insert:')
for (const row of inserted) {
  console.log(`  id=${row.id} name=${row.name}`)
}
console.log('  插件行存在:', inserted.some((r) => r.id === 'web-search-serper'))
