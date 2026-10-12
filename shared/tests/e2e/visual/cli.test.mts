/* eslint-disable @typescript-eslint/no-floating-promises, @typescript-eslint/require-await -- node:test registers top-level tests; they are not awaited. Fakes stand in for async deps */
import {test} from 'node:test'
import assert from 'node:assert/strict'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import {createRequire} from 'module'
import type {TourEntry} from './tour-types.ts'
import type {Capture} from './driver-desktop.mts'
import {makePng} from './compare.mts'
import {FIXTURE_RUNTIME_VERSION} from './fixtures/names.ts'
process.env['KB_VISUAL_RESULTS'] = fs.mkdtempSync(path.join(os.tmpdir(), 'vcli-'))
const {parseCommand, runAa, runCheck, runGate, checkBaseInfra, realDeps, parseCoverageRange, coverageRangeRefusal, selectEntries} =
  await import('./cli.mts')
const Store = await import('./store.mts')
const {PNG} = createRequire(import.meta.url)('pngjs') as {PNG: {sync: {write: (p: unknown) => Buffer}}}

const entries: ReadonlyArray<TourEntry> = [
  {id: 'tab/chat', nav: {tab: 'tabs.chatTab'}, platforms: ['desktop', 'phone'], ready: 'x', seal: ['inbox']},
  {id: 'tab/git', nav: {tab: 'tabs.gitTab'}, platforms: ['desktop'], ready: 'x', seal: []},
]
const failed: Capture = {coverage: null, error: 'boom', masks: [], png: Buffer.alloc(0), status: 'failed'}

const deps = (over = {}) => ({
  baseSha: async () => 'abc',
  capture: async (): Promise<Capture> => {
    throw new Error('should not capture')
  },
  closeCapture: async () => {},
  currentShared: '/tree/shared',
  entries,
  fixtureHash: (name: string) => `hash-of-${name}`,
  hasBasePng: () => true,
  log: () => {},
  openReport: () => {},
  readBaseMeta: () => ({createdAt: 0, frozenAt: 1000, seal: {fields: {inbox: [1]}, hash: 'h', newestMessageMs: 0, takenAt: 0}}),
  readSeal: async () => ({fields: {inbox: [1]}, hash: 'h', newestMessageMs: 0, takenAt: 1}),
  servedFrom: () => '/tree/shared',
  team: () => 'testteam',
  ...over,
})

test('refuses without a base', async () => {
  await assert.rejects(runCheck(deps({hasBasePng: () => false}), ['tab/*']), /no base for tab\/chat at abc; run yarn visual:base tab\/chat/)
})

test('refuses without a base meta for the platform', async () => {
  await assert.rejects(runCheck(deps({readBaseMeta: () => undefined}), ['tab/*', '--ios']), /no base for tab\/\* at abc/)
})

test('refuses when the scoped seal changed', async () => {
  await assert.rejects(
    runCheck(deps({readSeal: async () => ({fields: {inbox: [2]}, hash: 'x', newestMessageMs: 0, takenAt: 1})}), ['tab/*']),
    /seal changed: inbox\[0\]: 1 → 2/
  )
})

test('reads only the fields the selected entries name, and none when they name none', async () => {
  const asked: Array<ReadonlyArray<string> | undefined> = []
  const readSeal = async (f?: ReadonlyArray<string>) => {
    asked.push(f)
    return {fields: {inbox: [1]}, hash: 'h', newestMessageMs: 0, takenAt: 1}
  }
  await runCheck(deps({capture: async () => failed, readSeal}), ['tab/chat'])
  await runCheck(deps({capture: async () => failed, readSeal}), ['tab/git'])
  assert.deepEqual(asked, [['inbox']])
})

test('refuses when the app is served from another tree', async () => {
  await assert.rejects(runCheck(deps({servedFrom: () => '/other/shared'}), ['tab/*']), /served from \/other\/shared/)
})

test('refuses when nothing serves the app', async () => {
  await assert.rejects(runCheck(deps({servedFrom: () => undefined}), ['tab/*', '--ios']), /nothing is listening on port 8081/)
})

test('unknown id refuses', async () => {
  await assert.rejects(runCheck(deps(), ['nope/*']), /no tour entry matches nope\/\*/)
})

test('an entry not on the platform does not match it', async () => {
  await assert.rejects(runCheck(deps(), ['tab/git', '--ios']), /no tour entry matches tab\/git on ios/)
})

test('captures with the base frozen instant, light by default and dark on request', async () => {
  const seen: Array<string> = []
  const capture = async (e: TourEntry, o: {frozenAt: number; theme: string; platform: string}) => {
    seen.push(`${e.id} ${o.platform} ${o.theme} ${o.frozenAt}`)
    return failed
  }
  assert.equal(await runCheck(deps({capture}), ['tab/chat']), 1)
  assert.equal(await runCheck(deps({capture}), ['tab/chat', '--ios']), 1)
  assert.equal(await runCheck(deps({capture}), ['tab/chat', '--theme', 'dark']), 1)
  assert.deepEqual(seen, [
    'tab/chat desktop light 1000',
    'tab/chat ios light 1000',
    'tab/chat desktop dark 1000',
  ])
})

test('the capture session is closed even when a capture throws', async () => {
  let closed = 0
  await assert.rejects(
    runCheck(
      deps({
        capture: async () => {
          throw new Error('driver died')
        },
        closeCapture: async () => {
          closed++
        },
      }),
      ['tab/chat']
    ),
    /driver died/
  )
  assert.equal(closed, 1)
})

test('parseCommand: flags, themes and refusals', () => {
  assert.deepEqual(parseCommand(['tab/*', '--ios']), {base: undefined, coverage: false, ios: true, patterns: ['tab/*'], themes: ['light']})
  assert.deepEqual(parseCommand(['--themes', 'dark', 'a', 'b']).themes, ['dark'])
  assert.deepEqual(parseCommand(['--theme', 'dark']).themes, ['dark'])
  assert.deepEqual(parseCommand([]).themes, ['light'])
  assert.equal(parseCommand(['--base', 'HEAD~1']).base, 'HEAD~1')
  assert.equal(parseCommand(['--base=HEAD~1']).base, 'HEAD~1')
  assert.throws(() => parseCommand(['--ios', '--theme', 'dark']), /iOS captures are light only/)
  assert.throws(() => parseCommand(['--themes', 'sepia']), /unknown theme sepia/)
  assert.throws(() => parseCommand(['--bogus']), /bogus/)
})

test('check and gate resolve the --base the command was given, in either spelling', async () => {
  for (const argv of [['tab/*', '--base=no-such-ref-for-visual-test'], ['tab/*', '--base', 'no-such-ref-for-visual-test']]) {
    await assert.rejects(realDeps(parseCommand(argv)).baseSha(), /cannot resolve the base no-such-ref-for-visual-test/)
  }
})

test('checkBaseInfra refuses a base without the visual driver or launch-app --visual', () => {
  const files = (m: Record<string, string>) => (p: string) => m[p]
  const launch = 'shared/tests/e2e/electron/launch-app.mts'
  const driver = 'shared/tests/e2e/visual/driver-desktop.mts'
  const mark = 'shared/tests/e2e/visual/coverage/src-mark.tsx'
  const ok = {
    [driver]: 'x',
    [launch]: "const visual = process.argv.includes('--visual')\nconst coverage = process.argv.includes('--coverage')",
    [mark]: 'Object.assign(KbSrcMark, {__kbVisualSrcMark: true})',
  }
  const desktop = (coverage: boolean) => ({coverage, ios: false})
  assert.doesNotThrow(() => checkBaseInfra('abc', files(ok), desktop(true)))
  assert.throws(() => checkBaseInfra('abc', files({[launch]: ok[launch]!}), desktop(false)), /abc has no visual gate .*--base <ref>/s)
  assert.throws(() => checkBaseInfra('abc', files({[driver]: 'x', [launch]: 'old'}), desktop(false)), /--base <ref>/)
  assert.throws(() => checkBaseInfra('abc', files({...ok, [launch]: "process.argv.includes('--visual')"}), desktop(true)), /--coverage/)
  // a base whose marks record their mounts instead of carrying the flag the driver finds them by
  assert.throws(() => checkBaseInfra('abc', files({...ok, [mark]: 'React.useLayoutEffect(() => coverage.mount(id), [id])'}), desktop(true)), /coverage marks the driver cannot find/)
  assert.doesNotThrow(() => checkBaseInfra('abc', files({[driver]: 'x', [launch]: ok[launch]!}), desktop(false)))
})

test('checkBaseInfra refuses fixture entries from a base without the fixture runtime, or with another version of it', () => {
  const files = (m: Record<string, string>) => (p: string) => m[p]
  const iosDriver = 'shared/tests/e2e/visual/driver-ios.mts'
  const runtime = 'shared/tests/e2e/visual/fixtures/runtime.ts'
  const names = 'shared/tests/e2e/visual/fixtures/names.ts'
  const ios = {coverage: false, fixtures: true, ios: true}
  const version = (v: number) => `export const FIXTURE_RUNTIME_VERSION = ${v}\n`
  assert.throws(() => checkBaseInfra('abc', files({[iosDriver]: 'x'}), ios), /abc has no fixture runtime/)
  assert.doesNotThrow(() => checkBaseInfra('abc', files({[iosDriver]: 'x', [names]: version(FIXTURE_RUNTIME_VERSION), [runtime]: 'x'}), ios))
  assert.throws(
    () => checkBaseInfra('abc', files({[iosDriver]: 'x', [names]: version(FIXTURE_RUNTIME_VERSION - 1), [runtime]: 'x'}), ios),
    new RegExp(`abc has fixture runtime version ${FIXTURE_RUNTIME_VERSION - 1} .*this driver speaks ${FIXTURE_RUNTIME_VERSION}`)
  )
  assert.throws(() => checkBaseInfra('abc', files({[iosDriver]: 'x', [runtime]: 'x'}), ios), /fixture runtime version unknown/)
  assert.doesNotThrow(() => checkBaseInfra('abc', files({[iosDriver]: 'x'}), {...ios, fixtures: false}))
})

test('checkBaseInfra on iOS needs the iOS driver, and the babel coverage hook for --coverage', () => {
  const files = (m: Record<string, string>) => (p: string) => m[p]
  const iosDriver = 'shared/tests/e2e/visual/driver-ios.mts'
  const babel = 'shared/babel.config.js'
  const ios = (coverage: boolean) => ({coverage, ios: true})
  // the desktop pieces are not what iOS needs
  assert.doesNotThrow(() => checkBaseInfra('abc', files({[iosDriver]: 'x'}), ios(false)))
  assert.throws(() => checkBaseInfra('abc', files({}), ios(false)), /abc has no visual gate infra \(.*driver-ios\.mts\).*--base <ref>/)
  const mark = {'shared/tests/e2e/visual/coverage/src-mark.tsx': '__kbVisualSrcMark'}
  assert.doesNotThrow(() => checkBaseInfra('abc', files({...mark, [babel]: "process.env.KB_VISUAL_COVERAGE === '1'", [iosDriver]: 'x'}), ios(true)))
  assert.throws(() => checkBaseInfra('abc', files({[babel]: "process.env.KB_VISUAL_COVERAGE === '1'", [iosDriver]: 'x'}), ios(true)), /coverage marks the driver cannot find/)
  assert.throws(() => checkBaseInfra('abc', files({...mark, [babel]: 'module.exports = {}', [iosDriver]: 'x'}), ios(true)), /coverage hook in shared\/babel\.config\.js.*--coverage/)
})

test('aa: an unstable first capture fails the pair even when the second matches it', async () => {
  const lines: Array<string> = []
  let n = 0
  const capture = async (): Promise<Capture> => ({coverage: null, masks: [], png: pngOf(false), status: n++ === 0 ? 'unstable' : 'ok'})
  const code = await runAa(deps({capture, log: (l: string) => lines.push(l)}), ['tab/chat', '--theme', 'light'])
  assert.equal(code, 1)
  assert.match(lines[0]!, /^✗ tab\/chat desktop light round 1 unstable/)
  assert.match(lines.at(-1)!, /^✗ 1 of 2 pairs differ/)
})

test('aa: equal pairs pass; a seal change during the run voids it', async () => {
  const ok = async (): Promise<Capture> => ({coverage: null, masks: [], png: pngOf(false), status: 'ok'})
  const lines: Array<string> = []
  assert.equal(await runAa(deps({capture: ok, log: (l: string) => lines.push(l)}), ['tab/chat', '--theme', 'light']), 0)
  assert.equal(lines.at(-1), '✓ all 2 pairs equal')
  let s = 0
  const readSeal = async () => ({fields: {inbox: [s++]}, hash: 'h', newestMessageMs: 0, takenAt: 1})
  lines.length = 0
  assert.equal(await runAa(deps({capture: ok, log: (l: string) => lines.push(l), readSeal}), ['tab/chat', '--theme', 'light']), 1)
  assert.match(lines.join('\n'), /aa void: the account changed during the run: inbox\[0\]: 0 → 1/)
})

const pngOf = (paint: boolean) => {
  const p = makePng(4, 3)
  p.data.fill(255)
  if (paint) p.data.set([0, 0, 0, 255], (1 * 4 + 2) * 4)
  return PNG.sync.write(p)
}

test('compares against the base PNG: one line per entry and theme, report opened only on a difference', async () => {
  const base = Store.basePng('cmp', 'desktop', 'light', 'tab/chat')
  fs.mkdirSync(path.dirname(base), {recursive: true})
  fs.writeFileSync(base, pngOf(false))
  const lines: Array<string> = []
  const opened: Array<string> = []
  const run = async (paint: boolean) =>
    runCheck(
      deps({
        baseSha: async () => 'cmp',
        capture: async (): Promise<Capture> => ({coverage: null, masks: [], png: pngOf(paint), status: 'ok'}),
        log: (l: string) => lines.push(l),
        openReport: (p: string) => opened.push(p),
      }),
      ['tab/chat', '--theme', 'light']
    )
  assert.equal(await run(false), 0)
  assert.equal(lines[0], '✓ tab/chat desktop light 0 px')
  assert.equal(opened.length, 0)
  lines.length = 0
  assert.equal(await run(true), 1)
  assert.match(lines[0]!, /^✗ tab\/chat desktop light 1 px in 1×1 at \(2,1\) → .*tab__chat\.diff\.png$/)
  assert.equal(opened.length, 1)
  assert.ok(fs.existsSync(opened[0]!))
})

test('base masks are unioned with the capture masks', async () => {
  const base = Store.basePng('msk', 'desktop', 'light', 'tab/chat')
  fs.mkdirSync(path.dirname(base), {recursive: true})
  fs.writeFileSync(base, pngOf(false))
  fs.writeFileSync(Store.baseMasksPath('msk', 'desktop', 'light', 'tab/chat'), JSON.stringify([{height: 1, width: 1, x: 2, y: 1}]))
  const lines: Array<string> = []
  const code = await runCheck(
    deps({
      baseSha: async () => 'msk',
      capture: async (): Promise<Capture> => ({coverage: null, masks: [], png: pngOf(true), status: 'ok'}),
      log: (l: string) => lines.push(l),
    }),
    ['tab/chat', '--theme', 'light']
  )
  assert.equal(code, 0)
  assert.equal(lines[0], '✓ tab/chat desktop light 0 px')
})

test('an unstable capture fails even when it matches', async () => {
  const lines: Array<string> = []
  const code = await runCheck(
    deps({
      baseSha: async () => 'cmp',
      capture: async (): Promise<Capture> => ({coverage: null, masks: [], png: pngOf(false), status: 'unstable'}),
      log: (l: string) => lines.push(l),
    }),
    ['tab/chat', '--theme', 'light']
  )
  assert.equal(code, 1)
  assert.match(lines[0]!, /^✗ tab\/chat desktop light unstable/)
})

test('gate is void when the full seal changes during the run', async () => {
  let n = 0
  const lines: Array<string> = []
  const readSeal = async () => ({fields: {inbox: [1], teams: [n++]}, hash: 'h', newestMessageMs: 0, takenAt: 1})
  const code = await runGate(deps({capture: async () => failed, log: (l: string) => lines.push(l), readSeal}), [])
  assert.equal(code, 1)
  assert.match(lines.join('\n'), /gate void: the account changed during the run: teams\[0\]: 0 → 1/)
})

const convEntries: ReadonlyArray<TourEntry> = [
  {id: 'chat/short', nav: {tab: 'tabs.chatTab', thread: {channel: 'e2e-short', ref: 'conversationIDKey'}}, platforms: ['desktop'], ready: 'x', seal: ['inbox']},
  {
    id: 'team/channel',
    nav: {append: {name: 'teamChannel', params: {conversationIDKey: {channel: 'e2e-media', ref: 'conversationIDKey'}}}, tab: 'tabs.teamsTab'},
    platforms: ['desktop'],
    ready: 'x',
    seal: ['inbox'],
  },
]
const inboxSeal = (unread: ReadonlyArray<string>) => {
  const rows = ['e2e-short', 'e2e-media', 'other'].map(c => ({activeAtMs: 0, id: `id-${c}`, name: `testteam#${c}`, unread: unread.includes(c)}))
  return {fields: {inbox: rows}, hash: 'h', newestMessageMs: 0, takenAt: 0}
}

test('check, gate and aa refuse before capturing when a conversation the tour opens is unread', async () => {
  const seal = inboxSeal(['e2e-media'])
  const conv = deps({entries: convEntries, readBaseMeta: () => ({createdAt: 0, frozenAt: 1000, seal}), readSeal: async () => seal})
  const want = /unread: testteam#e2e-media \(conversation id-e2e-media\)\. The tour opens it.*Read it by hand first/
  await assert.rejects(runCheck(conv, ['team/channel']), want)
  await assert.rejects(runGate(conv, []), want)
  await assert.rejects(runAa(conv, []), want)
  // only the selected entries' conversations count
  await assert.rejects(runCheck(conv, ['chat/short']), /should not capture/)
})

test('an unread conversation the tour never opens does not refuse', async () => {
  const seal = inboxSeal(['other'])
  const conv = deps({entries: convEntries, readBaseMeta: () => ({createdAt: 0, frozenAt: 1000, seal}), readSeal: async () => seal})
  await assert.rejects(runCheck(conv, ['*']), /should not capture/)
})

test('coverage: a bare ref is the working tree; ranges name both sides', () => {
  assert.deepEqual(parseCoverageRange('HEAD'), {left: 'HEAD', right: undefined, symmetric: false})
  assert.deepEqual(parseCoverageRange('HEAD..'), {left: 'HEAD', right: 'HEAD', symmetric: false})
  assert.deepEqual(parseCoverageRange('origin/master...topic'), {left: 'origin/master', right: 'topic', symmetric: true})
  assert.deepEqual(parseCoverageRange('..HEAD~1'), {left: 'HEAD', right: 'HEAD~1', symmetric: false})
})

test('coverage refuses a range whose sides are one commit, and a diff with no .tsx file', () => {
  assert.match(
    coverageRangeRefusal({changedFiles: 3, leftSha: 'abc', range: 'HEAD..', rightSha: 'abc'}) ?? '',
    /HEAD\.\. is empty: both sides are abc.*yarn visual:coverage HEAD/
  )
  assert.match(
    coverageRangeRefusal({changedFiles: 0, leftSha: 'abc', range: 'HEAD', rightSha: undefined}) ?? '',
    /no \.tsx file changed in HEAD.*git add -N/
  )
  assert.equal(coverageRangeRefusal({changedFiles: 1, leftSha: 'abc', range: 'HEAD', rightSha: undefined}), undefined)
  assert.equal(coverageRangeRefusal({changedFiles: 1, leftSha: 'abc', range: 'abc..def', rightSha: 'def'}), undefined)
})
test('selecting a desktop entry that leaves a popup open brings the entry after it', () => {
  const es: ReadonlyArray<TourEntry> = [
    {id: 'team/menu', leavesPopup: true, nav: {tab: 'tabs.teamsTab'}, platforms: ['desktop', 'phone'], ready: 'x', seal: []},
    {id: 'team/phone', nav: {tab: 'tabs.teamsTab'}, platforms: ['phone'], ready: 'x', seal: []},
    {id: 'team/next', nav: {tab: 'tabs.teamsTab'}, platforms: ['desktop', 'phone'], ready: 'x', seal: []},
    {id: 'tab/git', nav: {tab: 'tabs.gitTab'}, platforms: ['desktop'], ready: 'x', seal: []},
  ]
  assert.deepEqual(selectEntries(es, ['team/menu'], 'desktop').map(e => e.id), ['team/menu', 'team/next'])
  assert.deepEqual(selectEntries(es, ['team/menu'], 'ios').map(e => e.id), ['team/menu'])
})

test('a fixture entry needs a base that ran the fixture as this tree defines it', async () => {
  const fx: TourEntry = {fixture: {name: 'featured-bots'}, id: 'modal/bots', nav: {tab: 'tabs.gitTab'}, platforms: ['desktop'], ready: 'x', seal: []}
  const meta = (fixtures?: Record<string, string>) => () => ({createdAt: 0, fixtures, frozenAt: 1000, seal: {fields: {}, hash: 'h', newestMessageMs: 0, takenAt: 0}})
  await assert.rejects(runCheck(deps({entries: [fx], readBaseMeta: meta()}), ['modal/bots']), /fixture featured-bots was not run since the base at abc/)
  await assert.rejects(
    runCheck(deps({entries: [fx], readBaseMeta: meta({'featured-bots': 'older'})}), ['modal/bots']),
    /fixture featured-bots changed since the base at abc; retake the base/
  )
  const ran: Array<string> = []
  await runCheck(
    deps({
      capture: async (e: TourEntry) => {
        ran.push(e.id)
        return failed
      },
      entries: [fx],
      readBaseMeta: meta({'featured-bots': 'hash-of-featured-bots'}),
    }),
    ['modal/bots']
  )
  assert.deepEqual(ran, ['modal/bots'])
})

// The capture dep prepares (a reload) whenever the theme changes, and again after closeCapture; a
// live capture may only follow a fixture capture across one of those.
const liveAfterFixture = (events: ReadonlyArray<{kind: 'close'} | {kind: 'capture'; e: TourEntry; theme: string}>) => {
  const problems: Array<string> = []
  let theme: string | undefined
  let fixtureSince = false
  for (const ev of events) {
    if (ev.kind === 'close') {
      theme = undefined
      fixtureSince = false
      continue
    }
    if (ev.theme !== theme) {
      theme = ev.theme
      fixtureSince = false
    }
    if (ev.e.fixture) fixtureSince = true
    else if (fixtureSince) problems.push(`${ev.e.id} ${ev.theme}`)
  }
  return problems
}

test('aa, check and gate never capture a live entry after a fixture entry without a fresh prepare', async () => {
  const fx: TourEntry = {fixture: {name: 'featured-bots'}, id: 'modal/bots', nav: {tab: 'tabs.gitTab'}, platforms: ['desktop'], ready: 'x', seal: []}
  const es = [...entries, fx]
  const meta = () => ({createdAt: 0, fixtures: {'featured-bots': 'hash-of-featured-bots'}, frozenAt: 1000, seal: {fields: {inbox: [1]}, hash: 'h', newestMessageMs: 0, takenAt: 0}})
  const events: Array<{kind: 'close'} | {kind: 'capture'; e: TourEntry; theme: string}> = []
  // aa compares its own pairs; check and gate get failed captures, so they read no base PNG
  let result: Capture = {coverage: null, masks: [], png: pngOf(false), status: 'ok'}
  const recording = deps({
    capture: async (e: TourEntry, o: {theme: string}): Promise<Capture> => {
      events.push({e, kind: 'capture', theme: o.theme})
      return result
    },
    closeCapture: async () => {
      events.push({kind: 'close'})
    },
    entries: es,
    readBaseMeta: meta,
  })
  await runAa(recording, ['*', '--themes', 'light,dark'])
  assert.ok(events.some(ev => ev.kind === 'capture' && ev.e.fixture), 'the fixture entry ran')
  assert.deepEqual(liveAfterFixture(events), [])
  events.length = 0
  result = failed
  await runCheck(recording, ['*', '--themes', 'light,dark'])
  await runGate(recording, ['--themes', 'light,dark'])
  assert.ok(events.some(ev => ev.kind === 'capture' && ev.e.fixture), 'the fixture entry ran')
  assert.deepEqual(liveAfterFixture(events), [])
})
