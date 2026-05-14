#!/usr/bin/env node
import {readdirSync, writeFileSync, existsSync} from 'fs'
import {join, relative} from 'path'
import {fileURLToPath} from 'url'

const sharedDir = join(fileURLToPath(import.meta.url), '..', '..')

const PLATFORMS = ['desktop', 'native']
const EXTENSIONS = ['.tsx', '.ts', '.mts']
const SKIP_DIRS = new Set(['node_modules', '.tsOuts', 'dist', 'build', 'tools'])

function walk(dir, results = []) {
  for (const entry of readdirSync(dir, {withFileTypes: true})) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(join(dir, entry.name), results)
    } else {
      results.push(join(dir, entry.name))
    }
  }
  return results
}

// Collect all files
const allFiles = new Set(walk(sharedDir))

// For each platform, find modules that have a platform variant but no plain variant
function buildPaths(platform) {
  const paths = {'@/*': ['./*']}

  for (const file of allFiles) {
    for (const ext of EXTENSIONS) {
      const suffix = `.${platform}${ext}`
      if (!file.endsWith(suffix)) continue

      // e.g. /shared/styles/index.desktop.tsx → base = /shared/styles/index
      const base = file.slice(0, -suffix.length)

      // Check if a plain variant exists (foo.tsx / foo.ts / foo.mts)
      const hasPlain = EXTENSIONS.some(e => existsSync(base + e))
      if (hasPlain) continue

      // Generate the @/* key and value
      const rel = relative(sharedDir, base) // e.g. "styles/index"
      const key = `@/${rel}`               // e.g. "@/styles/index"
      const value = `./${rel}.${platform}` // e.g. "./styles/index.desktop"
      paths[key] = [value]
    }
  }

  return paths
}

for (const platform of PLATFORMS) {
  const paths = buildPaths(platform)
  const out = {compilerOptions: {paths}}
  const outFile = join(sharedDir, `tsconfig.paths.${platform}.json`)
  writeFileSync(outFile, JSON.stringify(out, null, 2) + '\n')
  console.log(`wrote tsconfig.paths.${platform}.json (${Object.keys(paths).length - 1} platform paths)`)
}
