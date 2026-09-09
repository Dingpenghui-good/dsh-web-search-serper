import { defineConfig } from 'tsdown'

export default defineConfig({
  name: '@dsh-web-search-serper',
  entry: ['src/index.ts'],
  outDir: 'lib',
  format: ['esm'],
  platform: 'node',
  target: 'es2024',
  fixedExtension: false,
  dts: true,
  clean: true,
})
