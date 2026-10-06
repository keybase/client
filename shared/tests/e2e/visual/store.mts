// Where the visual gate keeps its files. Under tests/results/visual (KB_VISUAL_RESULTS overrides):
//   base/<sha>/<platform>/meta.json                       BaseMeta for that platform's base set
//   base/<sha>/<platform>/<theme>/<id>.png                base capture
//   base/<sha>/<platform>/<theme>/<id>.masks.json         mask rects the base capture had
//   base/<sha>/<platform>/<theme>/coverage/<id>.json      call sites the capture drew (--coverage)
//   runs/<stamp>/...                                      one check, gate or aa run and its report
// Ids map to file names with '/' replaced by '__'.
import * as fs from 'fs'
import * as path from 'path'
import {fileURLToPath} from 'url'
import type {Rect} from './compare.mts'
import type {Seal} from './seal.mts'
import type {Theme} from './tour-types.ts'

export type RunPlatform = 'desktop' | 'ios'
// `fixtures`: the definition hash (fixtures/drive.mts) of each fixture the base's entries ran under
export type BaseMeta = {seal: Seal; frozenAt: number; createdAt: number; fixtures?: Record<string, string>}

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

// A coverage file: the `file:line` ids drawn in the entry's capture (`visible`: an instance on
// screen when it was taken, coverage/visible.ts), and whether the entry has masks. A masked entry's
// call sites may sit under a mask, where the compare never sees their pixels, so a masked entry
// counts for no coverage. A file without the `masked` flag cannot say whether its entry was masked,
// and one without `visible` counts sites the capture did not show, so either is refused.
export type CoverageFile = {ids: ReadonlyArray<string>; masked: boolean; visible: true}

export const writeCoverageJson = (ids: ReadonlyArray<string>, masked: boolean) =>
  JSON.stringify({ids, masked, visible: true} satisfies CoverageFile)

export const parseCoverageFile = (raw: unknown, file: string): CoverageFile => {
  if (Array.isArray(raw)) throw new Error(`${file} has no masked flag: retake the coverage base`)
  if ((raw as Partial<CoverageFile>).visible !== true) {
    throw new Error(`${file} counts sites its capture did not show: retake the coverage base`)
  }
  return raw as CoverageFile
}

// The union of every unmasked coverage file stored under base/<sha>, and the files skipped
// because their entry is masked (`<platform>/<theme>/<id>`).
export const readBaseCoverage = (sha: string): {mounted: Array<string>; masked: Array<string>} => {
  const out = new Set<string>()
  const masked: Array<string> = []
  const root = baseDir(sha)
  const walk = (dir: string) => {
    if (!fs.existsSync(dir)) return
    for (const d of fs.readdirSync(dir, {withFileTypes: true})) {
      const p = path.join(dir, d.name)
      if (d.isDirectory()) walk(p)
      else if (path.basename(dir) === 'coverage' && d.name.endsWith('.json')) {
        const file = parseCoverageFile(JSON.parse(fs.readFileSync(p, 'utf8')), p)
        if (file.masked) masked.push(path.relative(root, p).replace(`${path.sep}coverage${path.sep}`, path.sep).replace(/\.json$/, ''))
        else for (const id of file.ids) out.add(id)
      }
    }
  }
  walk(root)
  return {masked: masked.sort(), mounted: [...out].sort()}
}

export const runStamp = (d = new Date()) => d.toISOString().replace(/[:.]/g, '-')
export const runDir = (stamp: string) => path.join(resultsDir(), 'runs', stamp)
