// Serper 端点/密钥探测：只读，不修改任何配置
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const credPath = join(homedir(), '.dsh', '.credentials.yaml')
const yaml = readFileSync(credPath, 'utf8')
const key = /SERPER_API_KEY:\s*(\S+)/.exec(yaml)?.[1]
if (!key) { console.log('未在凭据库找到 SERPER_API_KEY'); process.exit(1) }
console.log(`凭据库密钥: 长度=${key.length} 前4位=${key.slice(0, 4)}****`)

// 生产配置里 baseURL 的实际取值 + 插件代码拼接方式（`${baseURL}/search`）
const targets = [
  ['官方默认端点', 'https://google.serper.dev/search'],
  ['profile 配置值 (正确拼接)', 'https://serper.dev/search'],
  ['profile 配置值 (末尾斜杠导致双斜杠)', 'https://serper.dev//search'],
]

for (const [label, url] of targets) {
  const t0 = Date.now()
  try {
    const res = await fetch(url, {
      method: 'POST',
      redirect: 'error', // 与插件一致：重定向视为错误
      headers: {
        'X-Api-Key': key,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ q: 'DeepSeek Harness', num: 3 }),
    })
    const text = await res.text()
    console.log(`\n[${label}] ${url}`)
    console.log(`  -> HTTP ${res.status}  ${Date.now() - t0}ms  content-type=${res.headers.get('content-type')}`)
    console.log(`  -> body[:160]: ${text.slice(0, 160).replace(/\s+/g, ' ')}`)
    if (res.ok) {
      const j = JSON.parse(text)
      console.log(`  -> organic=${(j.organic ?? []).length}  first=${j.organic?.[0]?.title}`)
    }
  } catch (e) {
    console.log(`\n[${label}] ${url}`)
    console.log(`  -> ERROR ${Date.now() - t0}ms: ${e.message}`)
  }
}
