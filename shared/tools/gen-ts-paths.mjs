#!/usr/bin/env node
/* global console */
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

      // Check if a plain variant exists (foo.tsx / foo.ts / foo.mts / foo.d.ts)
      const hasPlain = EXTENSIONS.some(e => existsSync(base + e)) || existsSync(base + '.d.ts')
      if (hasPlain) continue

      // Generate the @/* key and value
      const rel = relative(sharedDir, base) // e.g. "styles/index"
      const key = `@/${rel}`               // e.g. "@/styles/index"
      const value = `./${rel}.${platform}` // e.g. "./styles/index.desktop"
      paths[key] = [value]

      // If rel ends with /index, also emit a bare-directory entry
      // but only when no index.d.ts exists (which would provide types via @/* catch-all)
      const parts = rel.split('/')
      if (parts[parts.length - 1] === 'index') {
        const bareRel = parts.slice(0, -1).join('/')
        if (bareRel) {
          const dirPath = join(sharedDir, bareRel)
          const hasIndexDts = existsSync(join(dirPath, 'index.d.ts'))
          if (!hasIndexDts) {
            const bareKey = `@/${bareRel}`
            const bareValue = `./${bareRel}/index.${platform}`
            paths[bareKey] = [bareValue]
          }
        }
      }
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
