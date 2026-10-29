import * as fs from 'fs'
import * as path from 'path'
import {fileURLToPath} from 'url'
import {parseArgs} from 'util'
import {
  capitalized,
  census,
  censusFailed,
  censusTotals,
  flowCoverageFromRuns,
  flowRunsFromReport,
  renderCensusMarkdown,
  renderCoverageFromRows,
  type CensusInput,
  type CoverageAttachment,
  type Exclusions,
  type FlowTestRun,
  type Recording,
  type RenderRow,
} from './census-lib.ts'
import type {RouteInfo} from '../../visual/routes-inventory.mts'

const sharedDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')

export type CensusPlatform = {
  platform: string
  // the --project default
  project: string
  // the --results default
  defaultResults: string
  // prefixes census.md and census.json
  outPrefix: string
  // named in "run X first" when the report is missing
  flowsCommand: string
  exclusions: Exclusions
  manualOnly: Record<string, unknown>
  surfaces: () => NonNullable<CensusInput['surfaces']>
  routes: () => Array<RouteInfo>
  // where census.md and census.json go and where the render dirs are looked up (default shared/tests/results)
  resultsDir?: string
  // the outgoing calls to cover (default: those in protocol/bin/enabled-calls.json)
  enabledRpcs?: () => Array<string>
}

const readCoverage = (a: CoverageAttachment): Recording => {
  const text = a.body !== undefined ? Buffer.from(a.body, 'base64').toString('utf8') : fs.readFileSync(a.path ?? '', 'utf8')
  return JSON.parse(text) as Recording
}

const flowRuns = (file: string, project: string, flowsCommand: string): Array<FlowTestRun> => {
  if (!fs.existsSync(file)) throw new Error(`no Playwright json report at ${file}: run ${flowsCommand} first`)
  const report = JSON.parse(fs.readFileSync(file, 'utf8')) as {suites: Parameters<typeof flowRunsFromReport>[0]}
  return flowRunsFromReport(report.suites, project, readCoverage)
}

const newestRenderDir = (resultsDir: string) => {
  const root = path.join(resultsDir, 'visual/render')
  const dirs = fs.existsSync(root)
    ? fs
        .readdirSync(root)
        .filter(d => fs.existsSync(path.join(root, d, 'render.json')))
        .sort()
    : []
  const last = dirs.at(-1)
  if (!last) throw new Error(`no render.json under ${root}: run yarn visual:render first`)
  return path.join(root, last)
}

const renderRows = (dir: string) => (JSON.parse(fs.readFileSync(path.join(dir, 'render.json'), 'utf8')) as {entries: Array<RenderRow>}).entries

const enabledOutgoing = () => {
  const calls = JSON.parse(fs.readFileSync(path.join(sharedDir, '../protocol/bin/enabled-calls.json'), 'utf8')) as Record<
    string,
    {incoming?: boolean}
  >
  return Object.entries(calls)
    .filter(([, v]) => !v.incoming)
    .map(([k]) => k)
}

const checkManualReasons = (exclusions: Exclusions, manualOnly: Record<string, unknown>) => {
  const bad = Object.entries({...exclusions.routes, ...exclusions.rpcs})
    .map(([k, reason]) => [k, /^manual-only: ([\w-]+)/.exec(reason)?.[1]] as const)
    .filter(([, id]) => id !== undefined && !(id in manualOnly))
  if (bad.length) throw new Error(`exclusions name unknown MANUAL_ONLY ids: ${bad.map(([k, id]) => `${k} (${id})`).join(', ')}`)
}

const run = (p: CensusPlatform, argv: ReadonlyArray<string> | undefined): number => {
  const resultsDir = p.resultsDir ?? path.join(sharedDir, 'tests/results')
  const {values: args} = parseArgs({
    ...(argv ? {args: [...argv]} : {}),
    options: {
      'no-render': {type: 'boolean'},
      project: {default: p.project, type: 'string'},
      render: {type: 'string'},
      results: {default: p.defaultResults, type: 'string'},
    },
  })
  checkManualReasons(p.exclusions, p.manualOnly)
  const runs = flowRuns(args.results, args.project, p.flowsCommand)
  const {flows, problems: flowProblems} = flowCoverageFromRuns(runs)
  if (args['no-render'] && args.render) throw new Error('--render and --no-render are exclusive')
  const renderDir = args['no-render'] ? undefined : (args.render ?? newestRenderDir(resultsDir))
  const rows = renderDir ? renderRows(renderDir) : []
  const {entries, problems: renderProblems} = renderCoverageFromRows(rows)
  const result = census({
    coverageProblems: [...flowProblems, ...renderProblems],
    enabledRpcs: (p.enabledRpcs ?? enabledOutgoing)(),
    exclusions: p.exclusions,
    flowCoverage: flows,
    platform: p.platform,
    renderCoverage: entries,
    routes: p.routes(),
    surfaces: p.surfaces(),
  })
  const show = (f: string) => (path.resolve(f).startsWith(sharedDir + path.sep) ? path.relative(sharedDir, f) : f)
  const sources = [
    `${show(args.results)}: project ${args.project}, ${runs.length} tests, ${flows.length} passing with a recording`,
    renderDir ? `${show(renderDir)}: ${rows.length} entries, ${entries.length} rendered ok` : 'no render this run: no tour entry counts',
  ]
  const md = renderCensusMarkdown(result, {
    flowTests: flows.length,
    renderEntries: entries.length,
    sources,
  })
  const mdFile = path.join(resultsDir, `${p.outPrefix}census.md`)
  fs.mkdirSync(resultsDir, {recursive: true})
  fs.writeFileSync(mdFile, md)
  const {noun, staleSurfaces, surfaces: covered, unclaimedSurfaces, ...rest} = result
  const cap = capitalized(noun)
  const json = {[`stale${cap}s`]: staleSurfaces, [`unclaimed${cap}s`]: unclaimedSurfaces, [`${noun}s`]: covered, ...rest}
  fs.writeFileSync(
    path.join(resultsDir, `${p.outPrefix}census.json`),
    JSON.stringify({...json, sources: {project: args.project, render: renderDir ?? null, results: args.results}}, null, 2)
  )
  const t = censusTotals(result)
  console.log(
    `census: routes ${t.routesCovered} covered, ${t.routesUnclaimed} unclaimed, ${t.routesExcluded} excluded; ` +
      `writes ${t.writesCovered} covered, ${t.writesUnsent} unsent, ${t.writesBackground} background, ${t.writesExcluded} excluded; ` +
      `${noun}s ${t.surfacesCovered} covered, ${t.surfacesUnclaimed} unclaimed; ` +
      `${t.stale} stale exclusions, ${result.coverageProblems.length} coverage problems (${flows.length} passing flow tests, ${entries.length} rendered tour entries)`
  )
  console.log(`census: ${mdFile}`)
  for (const s of result.staleExclusions) console.log(`  stale: ${s}`)
  for (const s of result.staleSurfaces) console.log(`  stale ${noun} list: ${s}`)
  for (const s of result.unclaimedSurfaces) console.log(`  unclaimed ${noun}: ${s}`)
  for (const s of result.coverageProblems) console.log(`  coverage problem: ${s}`)
  return censusFailed(result) ? 1 : 0
}

export const runCensusCli = (p: CensusPlatform, argv?: ReadonlyArray<string>): number => {
  try {
    return run(p, argv)
  } catch (e) {
    console.error(`census: ${e instanceof Error ? e.message : String(e)}`)
    return 1
  }
}
