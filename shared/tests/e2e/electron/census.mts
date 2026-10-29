// yarn test:e2e:desktop:census [--results <results.json>] [--render <render dir> | --no-render] [--project <name>]
//
// Which routes, windows and write RPCs the last desktop flow run and visual render reached (see
// census-lib.ts), against the route inventory, the window list in census-windows.ts and the
// outgoing calls in protocol/bin/enabled-calls.json, less the reasoned exclusions in
// census-exclusions.ts. Reads:
//   the `coverage.json` attachment of each attempt in the Playwright json report (default
//     tests/results/report/results.json, project electron-flows); only passing attempts count
//   render.json of a `yarn visual:render` run (default the newest under tests/results/visual/render);
//     only entries that rendered ok count; --no-render counts no tour entry (a run whose render
//     wrote nothing), and census.md says so
// Writes tests/results/census.md and census.json. Exits 1 when a route or window is unclaimed, a
// write RPC is unsent, an exclusion or the window list is stale, or a passing test or rendered
// entry has no usable recording.
import * as fs from 'fs'
import * as path from 'path'
import {fileURLToPath} from 'url'
import {parseArgs} from 'util'
import {
  census,
  censusFailed,
  censusTotals,
  flowCoverageFromRuns,
  flowRunsFromReport,
  renderCensusMarkdown,
  renderCoverageFromRows,
  type CoverageAttachment,
  type FlowTestRun,
  type Recording,
  type RenderRow,
} from './census-lib.ts'
import {EXCLUSIONS} from './census-exclusions.ts'
import {CENSUS_WINDOWS} from './census-windows.ts'
import {MANUAL_ONLY} from './manual-only.ts'
import {listRoutes} from '../visual/routes-inventory.mts'

const sharedDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const resultsDir = path.join(sharedDir, 'tests/results')

const {values: args} = parseArgs({
  options: {
    'no-render': {type: 'boolean'},
    project: {default: 'electron-flows', type: 'string'},
    render: {type: 'string'},
    results: {default: path.join(resultsDir, 'report/results.json'), type: 'string'},
  },
})

const readCoverage = (a: CoverageAttachment): Recording => {
  const text = a.body !== undefined ? Buffer.from(a.body, 'base64').toString('utf8') : fs.readFileSync(a.path ?? '', 'utf8')
  return JSON.parse(text) as Recording
}

const flowRuns = (file: string, project: string): Array<FlowTestRun> => {
  if (!fs.existsSync(file)) throw new Error(`no Playwright json report at ${file}: run yarn test:e2e:desktop:flows first`)
  const report = JSON.parse(fs.readFileSync(file, 'utf8')) as {suites: Parameters<typeof flowRunsFromReport>[0]}
  return flowRunsFromReport(report.suites, project, readCoverage)
}

const newestRenderDir = () => {
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

// The app's remote window names, read from its source: the module itself only loads in the app.
const remoteWindowsFile = path.join(sharedDir, 'desktop/remote/remote-component.desktop.tsx')
const appWindows = () => {
  const m = /export const remoteComponentNames = \[([^\]]*)\] as const/.exec(fs.readFileSync(remoteWindowsFile, 'utf8'))
  const names = [...(m?.[1] ?? '').matchAll(/'([^']+)'/g)].map(x => x[1] ?? '')
  if (!names.length) throw new Error(`no remoteComponentNames list in ${remoteWindowsFile}: update census.mts to read the app's windows`)
  return names
}

const checkManualReasons = () => {
  const bad = Object.entries({...EXCLUSIONS.routes, ...EXCLUSIONS.rpcs})
    .map(([k, reason]) => [k, /^manual-only: ([\w-]+)/.exec(reason)?.[1]] as const)
    .filter(([, id]) => id !== undefined && !(id in MANUAL_ONLY))
  if (bad.length) throw new Error(`exclusions name unknown MANUAL_ONLY ids: ${bad.map(([k, id]) => `${k} (${id})`).join(', ')}`)
}

const main = () => {
  checkManualReasons()
  const runs = flowRuns(args.results, args.project)
  const {flows, problems: flowProblems} = flowCoverageFromRuns(runs)
  if (args['no-render'] && args.render) throw new Error('--render and --no-render are exclusive')
  const renderDir = args['no-render'] ? undefined : (args.render ?? newestRenderDir())
  const rows = renderDir ? renderRows(renderDir) : []
  const {entries, problems: renderProblems} = renderCoverageFromRows(rows)
  const result = census({
    coverageProblems: [...flowProblems, ...renderProblems],
    enabledRpcs: enabledOutgoing(),
    exclusions: EXCLUSIONS,
    flowCoverage: flows,
    renderCoverage: entries,
    routes: listRoutes(),
    windows: {existing: appWindows(), listed: CENSUS_WINDOWS},
  })
  const show = (p: string) => (path.resolve(p).startsWith(sharedDir + path.sep) ? path.relative(sharedDir, p) : p)
  const sources = [
    `${show(args.results)}: project ${args.project}, ${runs.length} tests, ${flows.length} passing with a recording`,
    renderDir ? `${show(renderDir)}: ${rows.length} entries, ${entries.length} rendered ok` : 'no render this run: no tour entry counts',
  ]
  const md = renderCensusMarkdown(result, {flowTests: flows.length, renderEntries: entries.length, sources})
  fs.mkdirSync(resultsDir, {recursive: true})
  fs.writeFileSync(path.join(resultsDir, 'census.md'), md)
  fs.writeFileSync(
    path.join(resultsDir, 'census.json'),
    JSON.stringify({...result, sources: {project: args.project, render: renderDir ?? null, results: args.results}}, null, 2)
  )
  const t = censusTotals(result)
  console.log(
    `census: routes ${t.routesCovered} covered, ${t.routesUnclaimed} unclaimed, ${t.routesExcluded} excluded; ` +
      `writes ${t.writesCovered} covered, ${t.writesUnsent} unsent, ${t.writesBackground} background, ${t.writesExcluded} excluded; ` +
      `windows ${t.windowsCovered} covered, ${t.windowsUnclaimed} unclaimed; ` +
      `${t.stale} stale exclusions, ${result.coverageProblems.length} coverage problems (${flows.length} passing flow tests, ${entries.length} rendered tour entries)`
  )
  console.log(`census: ${path.join(resultsDir, 'census.md')}`)
  for (const s of result.staleExclusions) console.log(`  stale: ${s}`)
  for (const s of result.staleWindows) console.log(`  stale window list: ${s}`)
  for (const s of result.unclaimedWindows) console.log(`  unclaimed window: ${s}`)
  for (const s of result.coverageProblems) console.log(`  coverage problem: ${s}`)
  return censusFailed(result) ? 1 : 0
}

try {
  process.exitCode = main()
} catch (e) {
  console.error(`census: ${e instanceof Error ? e.message : String(e)}`)
  process.exitCode = 1
}
