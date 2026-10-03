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
process.env['KB_VISUAL_RESULTS'] = fs.mkdtempSync(path.join(os.tmpdir(), 'vcli-'))
const {parseCommand, runCheck, runGate, checkBaseInfra} = await import('./cli.mts')
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
  hasBasePng: () => true,
  log: () => {},
  openReport: () => {},
  readBaseMeta: () => ({createdAt: 0, frozenAt: 1000, seal: {fields: {inbox: [1]}, hash: 'h', newestMessageMs: 0, takenAt: 0}}),
  readSeal: async () => ({fields: {inbox: [1]}, hash: 'h', newestMessageMs: 0, takenAt: 1}),
  servedFrom: () => '/tree/shared',
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

test('captures with the base frozen instant, every theme on desktop and light only on iOS', async () => {
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
    'tab/chat desktop dark 1000',
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
  assert.deepEqual(parseCommand([]).themes, ['light', 'dark'])
  assert.equal(parseCommand(['--base', 'HEAD~1']).base, 'HEAD~1')
  assert.throws(() => parseCommand(['--ios', '--theme', 'dark']), /iOS captures are light only/)
  assert.throws(() => parseCommand(['--themes', 'sepia']), /unknown theme sepia/)
  assert.throws(() => parseCommand(['--bogus']), /bogus/)
})

test('checkBaseInfra refuses a base without the visual driver or launch-app --visual', () => {
  const files = (m: Record<string, string>) => (p: string) => m[p]
  const launch = 'shared/tests/e2e/electron/launch-app.mts'
  const driver = 'shared/tests/e2e/visual/driver-desktop.mts'
  const ok = {[driver]: 'x', [launch]: "const visual = process.argv.includes('--visual')\nconst coverage = process.argv.includes('--coverage')"}
  assert.doesNotThrow(() => checkBaseInfra('abc', files(ok), {coverage: true}))
  assert.throws(() => checkBaseInfra('abc', files({[launch]: ok[launch]!}), {coverage: false}), /abc has no visual gate .*--base <ref>/s)
  assert.throws(() => checkBaseInfra('abc', files({[driver]: 'x', [launch]: 'old'}), {coverage: false}), /--base <ref>/)
  assert.throws(
    () => checkBaseInfra('abc', files({[driver]: 'x', [launch]: "process.argv.includes('--visual')"}), {coverage: true}),
    /--coverage/
  )
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
