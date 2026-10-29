import {
  BACKGROUND_MIN_TESTS,
  BACKGROUND_SHARE,
  census,
  censusFailed,
  flowCoverageFromRuns,
  flowRunsFromReport,
  isWriteRpc,
  renderCensusMarkdown,
  renderCoverageFromRows,
  type CensusInput,
  type Recording,
} from './census-lib'
import {summarizeFlows} from './release-lib'

const input = (over: Partial<CensusInput> = {}): CensusInput => ({
  enabledRpcs: [],
  exclusions: {routes: {}, rpcs: {}},
  flowCoverage: [],
  platform: 'desktop',
  renderCoverage: [],
  routes: [],
  ...over,
})

const flow = (test: string, rpcs: Array<string> = [], routes: Array<string> = []) => ({routes, rpcs, test})

test('a route covered only by a render entry counts as covered', () => {
  const r = census(
    input({
      renderCoverage: [{entry: 'settings/display', routes: ['settingsTabs.displayTab']}],
      routes: [{name: 'settingsTabs.displayTab'}, {name: 'settingsTabs.chatTab'}],
    })
  )
  expect(r.routes.find(x => x.name === 'settingsTabs.displayTab')?.coveredBy).toEqual(['tour settings/display'])
  expect(r.unclaimedRoutes).toEqual(['settingsTabs.chatTab'])
})

test('a route recorded only outside the inventory (tabs, loggedIn) is not listed', () => {
  const r = census(input({flowCoverage: [flow('a', [], ['loggedIn', 'tabs.chatTab'])], routes: [{name: 'chatRoot'}]}))
  expect(r.routes.map(x => x.name)).toEqual(['chatRoot'])
})

test('an excluded route that a flow covers is stale, and is not unclaimed', () => {
  const r = census(
    input({
      exclusions: {routes: {chatConversation: 'phone only', gone: 'old'}, rpcs: {}},
      flowCoverage: [flow('chat › opens', [], ['chatConversation'])],
      routes: [{name: 'chatConversation'}, {name: 'chatLocationPreview'}],
    })
  )
  expect(r.staleExclusions).toEqual([
    'route chatConversation is excluded (phone only) but covered by: flow chat › opens',
    'route gone is excluded (old) but is not a route',
  ])
  expect(r.unclaimedRoutes).toEqual(['chatLocationPreview'])
})

test('an excluded, uncovered route is neither unclaimed nor stale', () => {
  const r = census(input({exclusions: {routes: {chatLocationPreview: 'phone only'}, rpcs: {}}, routes: [{name: 'chatLocationPreview'}]}))
  expect(r.unclaimedRoutes).toEqual([])
  expect(r.staleExclusions).toEqual([])
  expect(r.routes[0]?.excluded).toBe('phone only')
})

test('a write RPC sent by any flow is covered', () => {
  const post = 'chat.1.local.postTextNonblock'
  const del = 'chat.1.local.postDeleteNonblock'
  const r = census(input({enabledRpcs: [post, del], flowCoverage: [flow('chat › send', [post]), flow('other')]}))
  expect(r.writes.find(w => w.rpc === post)?.sentBy).toEqual(['chat › send'])
  expect(r.unsentWrites).toEqual([del])
})

test('a read RPC never appears in unsentWrites', () => {
  const r = census(input({enabledRpcs: ['keybase.1.user.loadMySettings', 'chat.1.local.getThreadNonblock']}))
  expect(r.writes).toEqual([])
  expect(r.unsentWrites).toEqual([])
})

test('write names: the regex on the method, or on it with the protocol name taken off, plus the hand list', () => {
  expect(isWriteRpc('chat.1.local.postTextNonblock')).toBe(true)
  expect(isWriteRpc('chat.1.local.CancelPost')).toBe(true)
  expect(isWriteRpc('keybase.1.teams.teamCreate')).toBe(true)
  expect(isWriteRpc('keybase.1.SimpleFS.simpleFSMove')).toBe(true)
  expect(isWriteRpc('keybase.1.saltpack.saltpackEncryptString')).toBe(true)
  expect(isWriteRpc('keybase.1.user.profileEdit')).toBe(true)
  expect(isWriteRpc('keybase.1.SimpleFS.simpleFSSettings')).toBe(false)
  expect(isWriteRpc('keybase.1.teams.teamGetMembersByID')).toBe(false)
  expect(isWriteRpc('keybase.1.user.userCard')).toBe(false)
})

test('a write sent in nearly every flow is background: its own table, neither covering nor unsent', () => {
  const bg = 'keybase.1.config.updateLastLoggedInAndServerConfig'
  const n = BACKGROUND_MIN_TESTS + 2
  const flows = Array.from({length: n}, (_, i) => flow(`t${i}`, i === 0 ? [] : [bg]))
  const r = census(input({enabledRpcs: [bg], flowCoverage: flows}))
  expect(r.background).toEqual([{of: n, rpc: bg, sentIn: n - 1}])
  expect(r.unsentWrites).toEqual([])
  expect(r.writes[0]?.background).toBe(true)
})

test('a write sent by every flow of a small run is not background', () => {
  const w = 'keybase.1.config.updateLastLoggedInAndServerConfig'
  const r = census(input({enabledRpcs: [w], flowCoverage: [flow('a', [w]), flow('b', [w])]}))
  expect(r.background).toEqual([])
  expect(r.writes[0]?.sentBy).toEqual(['a', 'b'])
})

test('a write sent in fewer than BACKGROUND_SHARE of many flows covers', () => {
  const w = 'chat.1.local.markAsReadLocal'
  const n = Math.ceil(BACKGROUND_MIN_TESTS / BACKGROUND_SHARE) + 4
  const sent = Math.ceil(BACKGROUND_SHARE * n) - 1
  const flows = Array.from({length: n}, (_, i) => flow(`t${i}`, i < sent ? [w] : []))
  const r = census(input({enabledRpcs: [w], flowCoverage: flows}))
  expect(sent).toBeGreaterThanOrEqual(BACKGROUND_MIN_TESTS)
  expect(r.background).toEqual([])
  expect(r.writes[0]?.sentBy).toHaveLength(sent)
  expect(r.unsentWrites).toEqual([])
})

test('an excluded write that a flow sends is stale; one that is no longer a sendable write is stale', () => {
  const w = 'keybase.1.config.logSend'
  const r = census(
    input({
      enabledRpcs: [w],
      exclusions: {routes: {}, rpcs: {[w]: 'manual-only: feedback-send', 'keybase.1.gone.removeIt': 'dead'}},
      flowCoverage: [flow('feedback › send', [w])],
    })
  )
  expect(r.staleExclusions).toEqual([
    'rpc keybase.1.config.logSend is excluded (manual-only: feedback-send) but sent by: feedback › send',
    'rpc keybase.1.gone.removeIt is excluded (dead) but is not a write RPC the desktop app can send',
  ])
  expect(r.unsentWrites).toEqual([])
})

test('the markdown has a section per table with the totals', () => {
  const r = census(
    input({
      enabledRpcs: ['chat.1.local.postTextNonblock'],
      renderCoverage: [{entry: 'chat/x', routes: ['chatRoot']}],
      routes: [{name: 'chatRoot'}, {name: 'login'}],
    })
  )
  const md = renderCensusMarkdown(r, {flowTests: 0, renderEntries: 1, sources: ['results.json (project electron-flows)']})
  expect(md).toContain('- results.json (project electron-flows)')
  expect(md).toContain('Routes: 1 covered, 1 unclaimed, 0 excluded')
  expect(md).toContain('| login |')
  expect(md).toContain('## Unsent write RPCs')
  expect(md).toContain('| chat.1.local.postTextNonblock |')
})

const rec = (over: Partial<Recording> = {}): Recording => ({routes: [], rpcs: [], startRoutes: [], ...over})

test('only passing attempts count: a flaky test credits its pass, never its failed attempt', () => {
  const {flows, problems} = flowCoverageFromRuns([
    {
      attempts: [
        {coverage: rec({routes: ['teamDeleteTeam'], rpcs: ['keybase.1.teams.teamDelete']}), status: 'failed'},
        {coverage: rec({routes: ['team'], rpcs: ['keybase.1.teams.teamRename']}), status: 'passed'},
      ],
      test: 'flaky',
    },
    {attempts: [{coverage: rec({routes: ['gitRoot']}), status: 'failed'}], test: 'failed'},
    {attempts: [{status: 'skipped'}], test: 'skipped'},
  ])
  expect(problems).toEqual([])
  expect(flows).toEqual([{routes: ['team'], rpcs: ['keybase.1.teams.teamRename'], test: 'flaky'}])
})

test('a passing test with a missing, failed or pre-startRoutes recording is a problem and credits nothing', () => {
  const {flows, problems} = flowCoverageFromRuns([
    {attempts: [{status: 'passed'}], test: 'none'},
    {attempts: [{coverage: rec({error: 'take timed out', routes: ['gitRoot']}), status: 'passed'}], test: 'broken'},
    {attempts: [{coverage: {routes: ['gitRoot'], rpcs: []}, status: 'passed'}], test: 'old'},
    {attempts: [{coverage: rec({error: 'take timed out'}), status: 'failed'}], test: 'failed with error'},
  ])
  expect(flows).toEqual([])
  expect(problems).toEqual([
    'none: passed without a coverage.json',
    'broken: its coverage.json has an error: take timed out',
    'old: its coverage.json has no startRoutes (recorded by an older bundle)',
  ])
})

test('a screen only shown at start (startRoutes) is not credited', () => {
  const {flows} = flowCoverageFromRuns([
    {attempts: [{coverage: rec({routes: ['chatRoot'], startRoutes: ['settingsRoot', 'settingsTabs.displayTab']}), status: 'passed'}], test: 't'},
  ])
  const r = census(input({flowCoverage: flows, routes: [{name: 'chatRoot'}, {name: 'settingsTabs.displayTab'}]}))
  expect(r.unclaimedRoutes).toEqual(['settingsTabs.displayTab'])
})

test('render: only entries that rendered ok credit routes; an ok entry without startRoutes is a problem', () => {
  const {entries, problems} = renderCoverageFromRows([
    {id: 'a', routes: ['chatRoot'], startRoutes: [], status: 'ok'},
    {id: 'b', routes: ['gitRoot'], startRoutes: [], status: 'failed'},
    {id: 'c', routes: ['teamsRoot'], startRoutes: [], status: 'unstable'},
    {id: 'd', routes: ['fsRoot'], status: 'ok'},
  ])
  expect(entries).toEqual([{entry: 'a', routes: ['chatRoot']}])
  expect(problems).toEqual(['tour d: its recording has no startRoutes (rendered by an older bundle)'])
})

test('coverage problems fail the census on their own', () => {
  const r = census(input({coverageProblems: ['none: passed without a coverage.json']}))
  expect(r.coverageProblems).toEqual(['none: passed without a coverage.json'])
  expect(censusFailed(r)).toBe(true)
  expect(censusFailed(census(input()))).toBe(false)
})

const OLD_DESKTOP_MARKDOWN = `# Coverage census

From 1 passing flow tests and 2 rendered tour entries.

Sources:

- a.json: x
- b: y

- Routes: 2 covered, 1 unclaimed, 1 excluded
- Write RPCs: 1 covered, 0 unsent, 0 background, 1 excluded
- Windows: 1 covered, 1 unclaimed
- Stale exclusions: 1
- Stale window list entries: 2
- Coverage problems: 1

## Coverage problems (recordings that should have counted)

- none: passed without a coverage.json

## Stale exclusions

- rpc keybase.1.fake.fakeSend is excluded (gone) but is not a write RPC the desktop app can send

## Stale window list

- window gone is listed in census-windows.ts but the app has no such window
- window pinentry is in the app but not listed in census-windows.ts

## Unclaimed windows

| window |
| --- |
| pinentry |

## Unclaimed routes

| route |
| --- |
| fsRoot |

## Unsent write RPCs

(none)

## Background writes (sent in at least 80% of flow tests; not counted as covered)

(none)

## Windows

| window | covered by |
| --- | --- |
| menubar | tour window/menubar-menu |
| pinentry |  |

## Routes

| route | covered by | excluded |
| --- | --- | --- |
| chatRoot | flow a |  |
| gitRoot |  | phone only |
| teamsRoot | tour window/menubar-menu |  |
| fsRoot |  |  |

## Write RPCs

| rpc | sent by | excluded |
| --- | --- | --- |
| keybase.1.teams.teamCreate | a |  |
| keybase.1.teams.teamDelete |  | owner: no |
`

describe('windows', () => {
  const windows = {existing: ['menubar', 'tracker', 'unlock-folders'], listed: ['menubar', 'tracker', 'unlock-folders']}
  const surfaces = (w: {existing: Array<string>; listed: Array<string>}) => ({...w, entryPrefix: 'window/', listFile: 'census-windows.ts', noun: 'window'})

  test('a window is covered by a rendered window/<name> tour entry or its variants', () => {
    const r = census(
      input({
        renderCoverage: [
          {entry: 'window/menubar-menu', routes: []},
          {entry: 'window/unlock-folders', routes: []},
          {entry: 'settings/display', routes: []},
        ],
        surfaces: surfaces(windows),
      })
    )
    expect(r.surfaces).toEqual([
      {coveredBy: ['tour window/menubar-menu'], name: 'menubar'},
      {coveredBy: [], name: 'tracker'},
      {coveredBy: ['tour window/unlock-folders'], name: 'unlock-folders'},
    ])
    expect(r.unclaimedSurfaces).toEqual(['tracker'])
    expect(censusFailed(r)).toBe(true)
  })

  test('an entry credits the longest listed name it matches, never a shorter prefix', () => {
    const r = census(
      input({
        renderCoverage: [{entry: 'window/unlock-folders-paper-key', routes: []}],
        surfaces: surfaces({existing: ['unlock', 'unlock-folders'], listed: ['unlock', 'unlock-folders']}),
      })
    )
    expect(r.unclaimedSurfaces).toEqual(['unlock'])
  })

  test('every window covered fails nothing', () => {
    const r = census(
      input({
        renderCoverage: windows.listed.map(w => ({entry: `window/${w}`, routes: []})),
        surfaces: surfaces(windows),
      })
    )
    expect(r.unclaimedSurfaces).toEqual([])
    expect(r.staleSurfaces).toEqual([])
    expect(censusFailed(r)).toBe(false)
  })

  test('a listed window the app no longer has is stale; one it has but the list lacks is unclaimed and named', () => {
    const r = census(
      input({
        renderCoverage: [{entry: 'window/menubar', routes: []}, {entry: 'window/gone', routes: []}],
        surfaces: surfaces({existing: ['menubar', 'pinentry'], listed: ['menubar', 'gone']}),
      })
    )
    expect(r.staleSurfaces).toEqual([
      'window gone is listed in census-windows.ts but the app has no such window',
      'window pinentry is in the app but not listed in census-windows.ts',
    ])
    expect(r.unclaimedSurfaces).toEqual(['pinentry'])
    expect(censusFailed(r)).toBe(true)
  })

  test('the markdown lists unclaimed windows and every window', () => {
    const r = census(input({renderCoverage: [{entry: 'window/menubar', routes: []}], surfaces: surfaces(windows)}))
    const md = renderCensusMarkdown(r, {flowTests: 0, renderEntries: 1, sources: []})
    expect(md).toContain('- Windows: 1 covered, 2 unclaimed')
    expect(md).toContain('## Unclaimed windows')
    expect(md).toContain('| menubar | tour window/menubar |')
  })

  const fixture = (over: Partial<CensusInput> = {}) =>
    census(
      input({
        coverageProblems: ['none: passed without a coverage.json'],
        enabledRpcs: ['keybase.1.teams.teamCreate', 'keybase.1.teams.teamDelete', 'keybase.1.config.getConfig'],
        exclusions: {routes: {gitRoot: 'phone only'}, rpcs: {'keybase.1.teams.teamDelete': 'owner: no', 'keybase.1.fake.fakeSend': 'gone'}},
        flowCoverage: [flow('a', ['keybase.1.teams.teamCreate'], ['chatRoot'])],
        renderCoverage: [
          {entry: 'window/menubar-menu', routes: ['teamsRoot']},
          {entry: 'window/gone', routes: []},
        ],
        routes: [{name: 'chatRoot'}, {name: 'gitRoot'}, {name: 'teamsRoot'}, {name: 'fsRoot'}],
        surfaces: surfaces({existing: ['menubar', 'pinentry'], listed: ['menubar', 'gone']}),
        ...over,
      })
    )

  test('the desktop markdown keeps its window wording', () => {
    const md = renderCensusMarkdown(fixture(), {
      flowTests: 1,
      renderEntries: 2,
      sources: ['a.json: x', 'b: y'],
    })
    expect(md).toBe(OLD_DESKTOP_MARKDOWN)
  })

  test('another platform names its own surfaces, prefix and platform', () => {
    const r = fixture({
      exclusions: {routes: {}, rpcs: {'keybase.1.fake.fakeSend': 'gone'}},
      platform: 'iOS',
      renderCoverage: [{entry: 'surface/share-extension-sent', routes: []}],
      surfaces: {
        entryPrefix: 'surface/',
        existing: ['share-extension', 'widget'],
        listFile: 'census-surfaces.ts',
        listed: ['share-extension', 'gone'],
        noun: 'surface',
      },
    })
    expect(r.noun).toBe('surface')
    expect(r.surfaces).toEqual([
      {coveredBy: ['tour surface/share-extension-sent'], name: 'share-extension'},
      {coveredBy: [], name: 'widget'},
    ])
    expect(r.staleSurfaces).toEqual([
      'surface gone is listed in census-surfaces.ts but the app has no such surface',
      'surface widget is in the app but not listed in census-surfaces.ts',
    ])
    const md = renderCensusMarkdown(r, {flowTests: 1, renderEntries: 1, sources: []})
    expect(md).toContain('- Surfaces: 1 covered, 1 unclaimed')
    expect(md).toContain('- Stale surface list entries: 2')
    expect(md).toContain('## Stale surface list')
    expect(md).toContain('## Unclaimed surfaces')
    expect(md).toContain('## Surfaces\n')
    expect(md).toContain('| surface | covered by |')
    expect(md).toContain('not a write RPC the iOS app can send')
    expect(md).not.toContain('window')
  })
})

describe('flowRunsFromReport', () => {
  test('names each test as the release summary does, a spec in a subdirectory included', () => {
    const rec = {routes: ['a'], rpcs: [], startRoutes: []}
    const test = (projectName: string) => ({
      projectName,
      results: [{attachments: [{body: Buffer.from(JSON.stringify(rec)).toString('base64'), name: 'coverage.json'}], status: 'failed'}],
      status: 'unexpected',
    })
    const suites = [
      {
        specs: [{file: 'flows/sub/deep.test.ts', tests: [test('electron-flows'), test('electron-flows-dark')], title: 'opens'}],
        suites: [{specs: [{file: 'flows/sub/deep.test.ts', tests: [test('electron-flows')], title: 'pages'}], title: 'paging'}],
        title: 'flows/sub/deep.test.ts',
      },
      {specs: [{file: 'flows/top.test.ts', tests: [test('electron-flows')], title: 'shows'}], title: 'flows/top.test.ts'},
    ]
    const runs = flowRunsFromReport(suites, 'electron-flows', () => rec)
    const names = runs.map(r => r.test)
    expect(names).toEqual(['deep › opens', 'deep › paging › pages', 'top › shows'])
    expect(summarizeFlows({suites: suites.map(s => ({...s}))}, 'electron-flows', {}).fresh).toEqual(names)
    expect(runs[0]?.attempts).toEqual([{coverage: rec, status: 'failed'}])
  })
})
