import { readFileSync } from 'node:fs'
const mod = await import('file:///E:/dsh-workspace/dsh-web-search-serper/lib/index.js')

// Scenario A: no credentials service, no env, no config
{
  let p
  const ctx = { web: { registerSearchProvider: x => { p = x } }, get: () => undefined }
  mod.apply(ctx, undefined)
  console.log('A available(no key source):', p.available())
  try { await p.search({ query: 'x' }) } catch (e) { console.log('A search error:', e.message) }
}

// Scenario B: credentials service resolving the real key -> live API call
{
  const key = process.argv[2]
  let p
  const ctx = {
    web: { registerSearchProvider: x => { p = x } },
    get: name => name === 'credentials' ? { resolve: async ref => ref === 'SERPER_API_KEY' ? { ref, value: key } : undefined } : undefined,
  }
  mod.apply(ctx, undefined)
  console.log('B available(cred key):', p.available())
  const t0 = Date.now()
  const r = await p.search({ query: 'DeepSeek Harness' })
  console.log('B results in', Date.now() - t0, 'ms:', r.sources.length, 'sources; first:', r.sources[0]?.title)
}
