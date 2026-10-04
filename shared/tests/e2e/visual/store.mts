// Where the visual gate keeps its files. Under tests/results/visual (KB_VISUAL_RESULTS overrides):
//   base/<sha>/<platform>/meta.json                       BaseMeta for that platform's base set
//   base/<sha>/<platform>/<theme>/<id>.png                base capture
//   base/<sha>/<platform>/<theme>/<id>.masks.json         mask rects the base capture had
//   base/<sha>/<platform>/<theme>/coverage/<id>.json      call sites the entry mounted (--coverage)
//   runs/<stamp>/...                                      one check, gate or aa run and its report
// Ids map to file names with '/' replaced by '__'.
import * as fs from 'fs'
import * as path from 'path'
import {fileURLToPath} from 'url'
import type {Rect} from './compare.mts'
import type {Seal} from './seal.mts'
import type {Theme} from './tour-types.ts'

export type RunPlatform = 'desktop' | 'ios'
export type BaseMeta = {seal: Seal; frozenAt: number; createdAt: number}

const sharedDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')

export const resultsDir = () => process.env['KB_VISUAL_RESULTS'] ?? path.join(sharedDir, 'tests', 'results', 'visual')

export const idFile = (id: string) => id.replaceAll('/', '__')

export const baseDir = (sha: string) => path.join(resultsDir(), 'base', sha)
export const basePlatformDir = (sha: string, platform: RunPlatform) => path.join(baseDir(sha), platform)
export const baseThemeDir = (sha: string, platform: RunPlatform, theme: Theme) =>
  path.join(basePlatformDir(sha, platform), theme)
export const basePng = (sha: string, platform: RunPlatform, theme: Theme, id: string) =>
  path.join(baseThemeDir(sha, platform, theme), `${idFile(id)}.png`)
export const baseMasksPath = (sha: string, platform: RunPlatform, theme: Theme, id: string) =>
  path.join(baseThemeDir(sha, platform, theme), `${idFile(id)}.masks.json`)
export const baseCoveragePath = (sha: string, platform: RunPlatform, theme: Theme, id: string) =>
  path.join(baseThemeDir(sha, platform, theme), 'coverage', `${idFile(id)}.json`)

const metaPath = (sha: string, platform: RunPlatform) => path.join(basePlatformDir(sha, platform), 'meta.json')

export const writeBaseMeta = (sha: string, platform: RunPlatform, meta: BaseMeta) => {
  fs.mkdirSync(basePlatformDir(sha, platform), {recursive: true})
  fs.writeFileSync(metaPath(sha, platform), JSON.stringify(meta, null, 2))
}

export const readBaseMeta = (sha: string, platform: RunPlatform): BaseMeta | undefined => {
  try {
    return JSON.parse(fs.readFileSync(metaPath(sha, platform), 'utf8')) as BaseMeta
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return undefined
    throw e
  }
}

// The base commit the last `visual:base` for a platform captured; check, gate and coverage use it
// when no --base is given.
const lastBasePath = (platform: RunPlatform) => path.join(resultsDir(), 'base', `last-${platform}.json`)

export const writeLastBase = (platform: RunPlatform, sha: string) => {
  fs.mkdirSync(path.dirname(lastBasePath(platform)), {recursive: true})
  fs.writeFileSync(lastBasePath(platform), JSON.stringify({sha}))
}

export const readLastBase = (platform: RunPlatform): string | undefined => {
  try {
    return (JSON.parse(fs.readFileSync(lastBasePath(platform), 'utf8')) as {sha: string}).sha
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return undefined
    throw e
  }
}

export const readBaseMasks = (sha: string, platform: RunPlatform, theme: Theme, id: string): Array<Rect> => {
  try {
    return JSON.parse(fs.readFileSync(baseMasksPath(sha, platform, theme, id), 'utf8')) as Array<Rect>
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw e
  }
}

export const hasBasePng = (sha: string, platform: RunPlatform, theme: Theme, id: string) =>
  fs.existsSync(basePng(sha, platform, theme, id))

// Every coverage JSON stored under base/<sha>, each a list of `file:line` ids.
export const readBaseCoverage = (sha: string): Array<string> => {
  const out = new Set<string>()
  const walk = (dir: string) => {
    if (!fs.existsSync(dir)) return
    for (const d of fs.readdirSync(dir, {withFileTypes: true})) {
      const p = path.join(dir, d.name)
      if (d.isDirectory()) walk(p)
      else if (path.basename(dir) === 'coverage' && d.name.endsWith('.json')) {
        for (const id of JSON.parse(fs.readFileSync(p, 'utf8')) as Array<string>) out.add(id)
      }
    }
  }
  walk(baseDir(sha))
  return [...out].sort()
}

export const runStamp = (d = new Date()) => d.toISOString().replace(/[:.]/g, '-')
export const runDir = (stamp: string) => path.join(resultsDir(), 'runs', stamp)
