// Which routes and write RPCs the desktop flows and the visual render reach, against what the app
// has. Pure: census.mts reads the run's files and writes the report; everything that decides is here.
//
// A route is covered when a passing flow test or a tour entry that rendered recorded it. A write
// RPC is covered only by a passing flow test that sent it: tour entries run under fixtures that
// refuse writes. Recorded names that are not in the route inventory (the tab navigators,
// `loggedIn`) are not listed. Only recordings that happened count: failed attempts, failed or
// unstable tour entries and recordings with an error credit nothing, and a passing test whose
// recording is missing or broken fails the census.

// A write the app sends on its own, whatever the test does (e.g. updateLastLoggedInAndServerConfig),
// would otherwise count as covered by every test. One sent in at least this share of the flow tests,
// and in at least BACKGROUND_MIN_TESTS of them, is reported as background instead.
import {eachFlowTest, flowTestName, type SuiteOf} from '../shared/gate/release-lib.ts'

export const BACKGROUND_SHARE = 0.8
export const BACKGROUND_MIN_TESTS = 10

const writeNameRe =
  /^(post|set|send|delete|create|add|remove|edit|join|leave|block|unblock|follow|unfollow|revoke|rename|upload|move|copy|mark|pin|unpin|accept|invite|reset|change|update|save|dismiss|toggle|archive|cancel|start|stop|import|export|sign|encrypt|decrypt)/i

// Writes the name test misses: the verb is not at the start of the method.
const ALSO_WRITES = new Set([
  'chat.1.local.RetryPost',
  'chat.1.local.bulkAddToConv',
  'chat.1.local.bulkAddToManyConvs',
  'chat.1.local.forwardMessageNonblock',
  'chat.1.local.ignorePinnedMessage',
  'chat.1.local.locationUpdate',
  'chat.1.local.newConversationLocal',
  'chat.1.local.putReacjiSkinTone',
  'chat.1.local.resolveUnfurlPrompt',
  'chat.1.local.trackGiphySelect',
  'keybase.1.account.enterResetPipeline',
  'keybase.1.account.passphraseChange',
  'keybase.1.account.userSetContactSettings',
  'keybase.1.config.guiSetValue',
  'keybase.1.config.logSend',
  'keybase.1.cryptocurrency.registerAddress',
  'keybase.1.ctl.dbNuke',
  'keybase.1.favorite.favoriteIgnore',
  'keybase.1.home.homeSkipTodoType',
  'keybase.1.identify3.identify3IgnoreUser',
  'keybase.1.install.installFuse',
  'keybase.1.install.installKBFS',
  'keybase.1.install.uninstallKBFS',
  'keybase.1.login.accountDelete',
  'keybase.1.login.deprovision',
  'keybase.1.login.login',
  'keybase.1.login.logout',
  'keybase.1.login.paperKey',
  'keybase.1.login.paperKeySubmit',
  'keybase.1.login.recoverPassphrase',
  'keybase.1.pgp.pgpKeyGenDefault',
  'keybase.1.pgp.pgpStorageDismiss',
  'keybase.1.phoneNumbers.resendVerificationForPhoneNumber',
  'keybase.1.phoneNumbers.verifyPhoneNumber',
  'keybase.1.rekey.rekeyStatusFinish',
  'keybase.1.teams.teamIgnoreRequest',
  'keybase.1.teams.teamReAddMemberAfterReset',
  'keybase.1.user.profileEdit',
  'keybase.1.user.reportUser',
])

// Calls the name test takes for writes: reads, and cancelling the app's own in-flight search.
const NOT_WRITES = new Set([
  'chat.1.local.archiveChatList',
  'chat.1.local.cancelActiveInboxSearch',
  'chat.1.local.cancelActiveSearch',
  'keybase.1.SimpleFS.simpleFSSettings',
])

// The method name, and the same name with its protocol's name taken off the front
// (`teams.teamCreate` -> `Create`, `SimpleFS.simpleFSMove` -> `Move`).
const methodNames = (rpc: string): Array<string> => {
  const parts = rpc.split('.')
  const method = parts.at(-1) ?? ''
  const proto = (parts.at(-2) ?? '').toLowerCase()
  const names = [method]
  for (const p of [proto, proto.replace(/s$/, '')]) {
    if (p && method.toLowerCase().startsWith(p) && method.length > p.length) {
      names.push(method.slice(p.length))
      break
    }
  }
  return names
}

export const isWriteRpc = (rpc: string): boolean => {
  if (NOT_WRITES.has(rpc)) return false
  return ALSO_WRITES.has(rpc) || methodNames(rpc).some(n => writeNameRe.test(n))
}

export type Exclusions = {routes: Record<string, string>; rpcs: Record<string, string>}

// What the recorder (visual/fixtures/runtime.ts) took. `routes` holds only states after the one shown
// at start that differed from the state before them; `startRoutes` is that start state. A screen
// left on by the previous test is therefore in startRoutes alone, and only `routes` is credited.
export type Recording = {routes: ReadonlyArray<string>; rpcs: ReadonlyArray<string>; startRoutes?: ReadonlyArray<string>; error?: string}

export type FlowTestRun = {test: string; attempts: ReadonlyArray<{status: string; coverage?: Recording}>}
export type FlowCoverage = {test: string; rpcs: Array<string>; routes: Array<string>}

export type CoverageAttachment = {name: string; body?: string; path?: string}
type CensusTest = {projectName: string; results: Array<{status: string; attachments: Array<CoverageAttachment>}>}

// Each test of the project, named as the release summary names it, with each attempt's status and
// recording (read by `read`); flowCoverageFromRuns decides which count.
export const flowRunsFromReport = (
  suites: ReadonlyArray<SuiteOf<CensusTest>>,
  project: string,
  read: (a: CoverageAttachment) => Recording
): Array<FlowTestRun> => {
  const out: Array<FlowTestRun> = []
  eachFlowTest(suites, project, (t, specFile, titles) => {
    const attempts = t.results.map(r => {
      const a = r.attachments.find(x => x.name === 'coverage.json')
      return a ? {coverage: read(a), status: r.status} : {status: r.status}
    })
    out.push({attempts, test: flowTestName(specFile, titles)})
  })
  return out
}

const recordingProblem = (r: Recording | undefined): string | undefined => {
  if (!r) return 'passed without a coverage.json'
  if (r.error) return `its coverage.json has an error: ${r.error}`
  if (!r.startRoutes) return 'its coverage.json has no startRoutes (recorded by an older bundle)'
  return undefined
}

// The coverage of each test from its passing attempts only: a flaky test's failed attempts credit
// nothing. A test with no passing attempt is left out; a passing attempt with a missing or broken
// recording is a problem, and that test credits nothing.
export const flowCoverageFromRuns = (runs: ReadonlyArray<FlowTestRun>): {flows: Array<FlowCoverage>; problems: Array<string>} => {
  const flows: Array<FlowCoverage> = []
  const problems: Array<string> = []
  for (const run of runs) {
    const passed = run.attempts.filter(a => a.status === 'passed')
    if (!passed.length) continue
    const bad = passed.map(a => recordingProblem(a.coverage)).filter((p): p is string => p !== undefined)
    if (bad.length) {
      problems.push(...bad.map(p => `${run.test}: ${p}`))
      continue
    }
    flows.push({
      routes: [...new Set(passed.flatMap(a => a.coverage?.routes ?? []))],
      rpcs: [...new Set(passed.flatMap(a => a.coverage?.rpcs ?? []))],
      test: run.test,
    })
  }
  return {flows, problems}
}

export type RenderRow = {id: string; status: string; routes: ReadonlyArray<string>; startRoutes?: ReadonlyArray<string>}

// Only entries that rendered (status ok) credit their routes.
export const renderCoverageFromRows = (
  rows: ReadonlyArray<RenderRow>
): {entries: Array<{entry: string; routes: Array<string>}>; problems: Array<string>} => {
  const entries: Array<{entry: string; routes: Array<string>}> = []
  const problems: Array<string> = []
  for (const r of rows) {
    if (r.status !== 'ok') continue
    if (!r.startRoutes) problems.push(`tour ${r.id}: its recording has no startRoutes (rendered by an older bundle)`)
    else entries.push({entry: r.id, routes: [...r.routes]})
  }
  return {entries, problems}
}

export type CensusInput = {
  routes: ReadonlyArray<{name: string}>
  // outgoing calls in enabled-calls.json
  enabledRpcs: ReadonlyArray<string>
  flowCoverage: ReadonlyArray<{test: string; rpcs: ReadonlyArray<string>; routes: ReadonlyArray<string>}>
  renderCoverage: ReadonlyArray<{entry: string; routes: ReadonlyArray<string>}>
  exclusions: Exclusions
  // recordings that should have counted and could not (flowCoverageFromRuns, renderCoverageFromRows)
  coverageProblems?: ReadonlyArray<string>
  // the app's other windows, which have no route: `listed` in census-windows.ts, `existing` the
  // ones the app has (desktop/remote's remoteComponentNames)
  windows?: {listed: ReadonlyArray<string>; existing: ReadonlyArray<string>}
}

export type CensusRoute = {name: string; coveredBy: Array<string>; excluded?: string}
export type CensusWrite = {rpc: string; sentBy: Array<string>; excluded?: string; background?: true}
export type CensusBackground = {rpc: string; sentIn: number; of: number}
export type CensusWindow = {name: string; coveredBy: Array<string>}

export type CensusResult = {
  routes: Array<CensusRoute>
  writes: Array<CensusWrite>
  background: Array<CensusBackground>
  unclaimedRoutes: Array<string>
  unsentWrites: Array<string>
  staleExclusions: Array<string>
  coverageProblems: Array<string>
  windows: Array<CensusWindow>
  unclaimedWindows: Array<string>
  // the window list out of step with the app
  staleWindows: Array<string>
}

export const censusFailed = (r: CensusResult) =>
  r.unclaimedRoutes.length > 0 ||
  r.unsentWrites.length > 0 ||
  r.staleExclusions.length > 0 ||
  r.coverageProblems.length > 0 ||
  r.unclaimedWindows.length > 0 ||
  r.staleWindows.length > 0

// A window is covered by a tour entry that rendered it: `window/<name>` or a variant
// `window/<name>-<state>`. An entry credits the longest name it matches, so `window/a-b-x` is a
// state of `a-b` and never of `a`.
const windowCensus = (
  w: NonNullable<CensusInput['windows']>,
  renderCoverage: CensusInput['renderCoverage']
): Pick<CensusResult, 'windows' | 'unclaimedWindows' | 'staleWindows'> => {
  const existing = new Set(w.existing)
  const listed = new Set(w.listed)
  const names = [...new Set([...w.listed, ...w.existing])].filter(n => existing.has(n)).sort()
  const byLength = [...names].sort((a, b) => b.length - a.length)
  const cover = new Map<string, Array<string>>()
  for (const {entry} of renderCoverage) {
    const name = byLength.find(n => entry === `window/${n}` || entry.startsWith(`window/${n}-`))
    if (name) cover.set(name, [...(cover.get(name) ?? []), `tour ${entry}`])
  }
  const windows = names.map(name => ({coveredBy: cover.get(name) ?? [], name}))
  return {
    staleWindows: [
      ...[...listed].filter(n => !existing.has(n)).map(n => `window ${n} is listed in census-windows.ts but the app has no such window`),
      ...[...existing].filter(n => !listed.has(n)).map(n => `window ${n} is in the app but not listed in census-windows.ts`),
    ],
    unclaimedWindows: windows.filter(x => !x.coveredBy.length).map(x => x.name),
    windows,
  }
}

export const census = (input: CensusInput): CensusResult => {
  const {exclusions, flowCoverage, renderCoverage} = input
  const staleExclusions: Array<string> = []

  const routeNames = [...new Set(input.routes.map(r => r.name))]
  const routeSet = new Set(routeNames)
  const routeCover = new Map<string, Array<string>>()
  const cover = (name: string, by: string) => {
    if (!routeSet.has(name)) return
    const list = routeCover.get(name) ?? []
    if (!list.includes(by)) list.push(by)
    routeCover.set(name, list)
  }
  for (const f of flowCoverage) for (const r of f.routes) cover(r, `flow ${f.test}`)
  for (const e of renderCoverage) for (const r of e.routes) cover(r, `tour ${e.entry}`)

  const routes = routeNames.map((name): CensusRoute => {
    const coveredBy = routeCover.get(name) ?? []
    const excluded = exclusions.routes[name]
    return excluded === undefined ? {coveredBy, name} : {coveredBy, excluded, name}
  })
  for (const [name, reason] of Object.entries(exclusions.routes)) {
    if (!routeSet.has(name)) staleExclusions.push(`route ${name} is excluded (${reason}) but is not a route`)
    else {
      const by = routeCover.get(name)
      if (by?.length) staleExclusions.push(`route ${name} is excluded (${reason}) but covered by: ${by.join(', ')}`)
    }
  }
  const unclaimedRoutes = routes.filter(r => !r.coveredBy.length && r.excluded === undefined).map(r => r.name)

  const writeNames = [...new Set(input.enabledRpcs.filter(isWriteRpc))].sort()
  const writeSet = new Set(writeNames)
  const sentBy = new Map<string, Array<string>>()
  for (const f of flowCoverage) {
    for (const rpc of new Set(f.rpcs)) {
      if (!writeSet.has(rpc)) continue
      const list = sentBy.get(rpc) ?? []
      if (!list.includes(f.test)) list.push(f.test)
      sentBy.set(rpc, list)
    }
  }
  // flowCoverage holds passing tests only (flowCoverageFromRuns), so the share is of passed tests
  const total = flowCoverage.length
  const isBackground = (n: number) => n >= BACKGROUND_MIN_TESTS && n >= BACKGROUND_SHARE * total
  const background: Array<CensusBackground> = []
  const writes = writeNames.map((rpc): CensusWrite => {
    const by = sentBy.get(rpc) ?? []
    const excluded = exclusions.rpcs[rpc]
    const row: CensusWrite = {rpc, sentBy: by}
    if (excluded !== undefined) row.excluded = excluded
    if (isBackground(by.length)) {
      row.background = true
      background.push({of: total, rpc, sentIn: by.length})
    }
    return row
  })
  const covered = (w: CensusWrite) => w.sentBy.length > 0 && !w.background
  for (const [rpc, reason] of Object.entries(exclusions.rpcs)) {
    const w = writes.find(x => x.rpc === rpc)
    if (!w) staleExclusions.push(`rpc ${rpc} is excluded (${reason}) but is not a write RPC the desktop app can send`)
    else if (covered(w)) staleExclusions.push(`rpc ${rpc} is excluded (${reason}) but sent by: ${w.sentBy.join(', ')}`)
  }
  const unsentWrites = writes.filter(w => !covered(w) && !w.background && w.excluded === undefined).map(w => w.rpc)

  return {
    ...windowCensus(input.windows ?? {existing: [], listed: []}, renderCoverage),
    background,
    coverageProblems: [...(input.coverageProblems ?? [])],
    routes,
    staleExclusions,
    unclaimedRoutes,
    unsentWrites,
    writes,
  }
}

const cell = (s: string) => s.replace(/\|/g, '\\|')
const table = (head: Array<string>, rows: Array<Array<string>>) =>
  rows.length
    ? [`| ${head.join(' | ')} |`, `|${head.map(() => ' --- ').join('|')}|`, ...rows.map(r => `| ${r.map(cell).join(' | ')} |`)].join('\n')
    : '(none)'

export const censusTotals = (r: CensusResult) => {
  const routesCovered = r.routes.filter(x => x.coveredBy.length && x.excluded === undefined).length
  const routesExcluded = r.routes.filter(x => x.excluded !== undefined).length
  const writesCovered = r.writes.filter(w => w.sentBy.length && !w.background && w.excluded === undefined).length
  const writesExcluded = r.writes.filter(w => w.excluded !== undefined).length
  return {
    routesCovered,
    routesExcluded,
    routesUnclaimed: r.unclaimedRoutes.length,
    stale: r.staleExclusions.length,
    writesBackground: r.background.length,
    writesCovered,
    writesExcluded,
    writesUnsent: r.unsentWrites.length,
    windowsCovered: r.windows.filter(x => x.coveredBy.length).length,
    windowsUnclaimed: r.unclaimedWindows.length,
  }
}

export type CensusMeta = {flowTests: number; renderEntries: number; sources: ReadonlyArray<string>}

export const renderCensusMarkdown = (r: CensusResult, meta: CensusMeta): string => {
  const t = censusTotals(r)
  const shortList = (xs: Array<string>) => (xs.length > 3 ? `${xs.slice(0, 3).join(', ')} (+${xs.length - 3})` : xs.join(', '))
  return [
    '# Coverage census',
    '',
    `From ${meta.flowTests} passing flow tests and ${meta.renderEntries} rendered tour entries.`,
    '',
    ...(meta.sources.length ? ['Sources:', '', ...meta.sources.map(s => `- ${s}`), ''] : []),
    `- Routes: ${t.routesCovered} covered, ${t.routesUnclaimed} unclaimed, ${t.routesExcluded} excluded`,
    `- Write RPCs: ${t.writesCovered} covered, ${t.writesUnsent} unsent, ${t.writesBackground} background, ${t.writesExcluded} excluded`,
    `- Windows: ${t.windowsCovered} covered, ${t.windowsUnclaimed} unclaimed`,
    `- Stale exclusions: ${t.stale}`,
    `- Stale window list entries: ${r.staleWindows.length}`,
    `- Coverage problems: ${r.coverageProblems.length}`,
    '',
    '## Coverage problems (recordings that should have counted)',
    '',
    r.coverageProblems.length ? r.coverageProblems.map(s => `- ${s}`).join('\n') : '(none)',
    '',
    '## Stale exclusions',
    '',
    r.staleExclusions.length ? r.staleExclusions.map(s => `- ${s}`).join('\n') : '(none)',
    '',
    '## Stale window list',
    '',
    r.staleWindows.length ? r.staleWindows.map(s => `- ${s}`).join('\n') : '(none)',
    '',
    '## Unclaimed windows',
    '',
    table(['window'], r.unclaimedWindows.map(n => [n])),
    '',
    '## Unclaimed routes',
    '',
    table(['route'], r.unclaimedRoutes.map(n => [n])),
    '',
    '## Unsent write RPCs',
    '',
    table(['rpc'], r.unsentWrites.map(n => [n])),
    '',
    `## Background writes (sent in at least ${Math.round(BACKGROUND_SHARE * 100)}% of flow tests; not counted as covered)`,
    '',
    table(['rpc', 'sent in'], r.background.map(b => [b.rpc, `${b.sentIn} of ${b.of}`])),
    '',
    '## Windows',
    '',
    table(['window', 'covered by'], r.windows.map(x => [x.name, shortList(x.coveredBy)])),
    '',
    '## Routes',
    '',
    table(
      ['route', 'covered by', 'excluded'],
      r.routes.map(x => [x.name, shortList(x.coveredBy), x.excluded ?? ''])
    ),
    '',
    '## Write RPCs',
    '',
    table(
      ['rpc', 'sent by', 'excluded'],
      r.writes.map(w => [w.rpc, w.background ? 'background' : shortList(w.sentBy), w.excluded ?? ''])
    ),
    '',
  ].join('\n')
}
