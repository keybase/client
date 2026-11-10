/* eslint-disable @typescript-eslint/no-floating-promises -- node:test registers top-level tests; they are not awaited */
import {test} from 'node:test'
import assert from 'node:assert/strict'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import {darkVariantOf, runFlowReport, type FlowReportPlatform} from './flow-report.mts'

const platform = (dir: string): FlowReportPlatform => ({
  checklistPath: path.join(dir, 'manual-checklist.md'),
  debugDir: path.join(dir, 'debug'),
  known: {flows: {}, render: {}},
  knownListFile: 'known-failures.ts',
  manualOnly: {signup: {doByHand: 'Walk the signup flow.', title: 'Signup'}},
  outputPath: path.join(dir, 'report.html'),
  prevDir: path.join(dir, 'prev'),
  resultsPath: path.join(dir, 'results.json'),
  runHint: 'yarn test:e2e:demo',
  title: 'Demo Report',
})

test('a results.json yields the report html and the manual checklist', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kb-flow-report-'))
  const results = {
    suites: [
      {
        specs: [
          {
            file: 'flows/chat.test.ts',
            ok: true,
            tests: [{projectName: 'electron', results: [{attachments: [], duration: 5, status: 'passed'}], status: 'expected'}],
            title: 'sends a message',
          },
        ],
        title: 'flows/chat.test.ts',
      },
    ],
  }
  fs.writeFileSync(path.join(dir, 'results.json'), JSON.stringify(results))
  assert.equal(runFlowReport(platform(dir), []), 0)
  const html = fs.readFileSync(path.join(dir, 'report.html'), 'utf8')
  assert.match(html, /sends a message/)
  assert.match(html, /Demo Report/)
  assert.match(fs.readFileSync(path.join(dir, 'manual-checklist.md'), 'utf8'), /Signup: Walk the signup flow\./)
})

test('a missing results.json exits 1 and writes an error report naming the run hint', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kb-flow-report-'))
  assert.equal(runFlowReport(platform(dir), []), 1)
  assert.match(fs.readFileSync(path.join(dir, 'report.html'), 'utf8'), /yarn test:e2e:demo/)
})

// one spec run in a light and a dark project, both failing, with a screenshot each
const twoProjectResults = () => {
  const png = Buffer.from('not really a png').toString('base64')
  const t = (projectName: string) => ({
    projectName,
    results: [{attachments: [{body: png, contentType: 'image/png', name: 'screenshot'}], duration: 5, errors: [{message: 'boom'}], status: 'failed'}],
    status: 'unexpected',
  })
  return {
    suites: [
      {
        specs: [],
        suites: [{specs: [{file: 'flows/chat.test.ts', ok: false, tests: [t('electron'), t('electron-dark')], title: 'sends a message'}], title: 'inbox'}],
        title: 'flows/chat.test.ts',
      },
    ],
  }
}

const known = {flows: {'chat › inbox › sends a message': 'flaky send'}, render: {}}

test('variantOf suffixes the variant card key and label and keeps the variant out of known failures', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kb-flow-report-'))
  fs.writeFileSync(path.join(dir, 'results.json'), JSON.stringify(twoProjectResults()))
  const p = {...platform(dir), known, variantOf: (n: string) => (n.endsWith('-dark') ? 'dark' : undefined)}
  assert.equal(runFlowReport(p, []), 0)
  assert.deepEqual(fs.readdirSync(p.debugDir).sort(), ['inbox-sends-a-message-dark.png', 'inbox-sends-a-message.png'])
  const html = fs.readFileSync(p.outputPath, 'utf8')
  assert.match(html, /inbox · sends a message \(dark\)/)
  // the light card takes the known verdict, the dark one does not
  assert.equal(html.split('known on master: flaky send').length - 1, 1)
})

test('without variantOf each project of a spec gets its own card, numbered after the first, with the known verdict', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kb-flow-report-'))
  fs.writeFileSync(path.join(dir, 'results.json'), JSON.stringify(twoProjectResults()))
  const p = {...platform(dir), known}
  assert.equal(runFlowReport(p, []), 0)
  assert.deepEqual(fs.readdirSync(p.debugDir).sort(), ['inbox-sends-a-message-2.png', 'inbox-sends-a-message.png'])
  const html = fs.readFileSync(p.outputPath, 'utf8')
  assert.doesNotMatch(html, /\(dark\)/)
  assert.equal(html.split('known on master: flaky send').length - 1, 2)
})

test('a tour entry captured twice shows why on its card; one captured once has no such mark', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kb-flow-report-'))
  fs.writeFileSync(path.join(dir, 'results.json'), JSON.stringify({suites: []}))
  const renderDir = path.join(dir, 'render')
  fs.mkdirSync(renderDir)
  const note = 'recaptured after the inspector page dropped: inspector connection closed before answering'
  const entries = [
    {id: 'settings/display', note, png: null, status: 'ok'},
    {id: 'settings/chat', png: null, status: 'ok'},
  ]
  fs.writeFileSync(path.join(renderDir, 'render.json'), JSON.stringify({entries}))
  assert.equal(runFlowReport(platform(dir), ['--render', renderDir]), 0)
  const html = fs.readFileSync(path.join(dir, 'report.html'), 'utf8')
  assert.ok(html.includes('tour · settings/display (recaptured)'))
  assert.ok(html.includes(note))
  assert.ok(html.includes('tour · settings/chat'))
  assert.ok(!html.includes('tour · settings/chat ('))
})

// a run at `startTime` of the named tests, each with a screenshot whose bytes name the run, and
// with a manual-<title> step; `skipped` names tests the run skipped
const runOf = (startTime: string, titles: Array<string>, skipped: Array<string> = []) => {
  const png = Buffer.from(startTime).toString('base64')
  return {
    stats: {startTime},
    suites: [
      {
        specs: titles.map(title => ({
          file: 'flows/chat.test.ts',
          ok: true,
          tests: [
            skipped.includes(title)
              ? {projectName: 'electron', results: [{attachments: [], duration: 0, status: 'skipped'}], status: 'skipped'}
              : {
                  projectName: 'electron',
                  results: [
                    {
                      attachments: [
                        {body: png, contentType: 'image/png', name: 'screenshot'},
                        {body: png, contentType: 'image/png', name: `step-01-manual-${title}`},
                      ],
                      duration: 5,
                      status: 'passed',
                    },
                  ],
                  status: 'expected',
                },
          ],
          title,
        })),
        title: 'flows/chat.test.ts',
      },
    ],
  }
}
const build = (dir: string, results: object, argv: Array<string> = []) => {
  fs.writeFileSync(path.join(dir, 'results.json'), JSON.stringify(results))
  assert.equal(runFlowReport(platform(dir), argv), 0)
  return fs.readFileSync(path.join(dir, 'report.html'), 'utf8')
}
const runAt = (dir: string, startTime: string, titles: Array<string>, argv: Array<string> = []) => build(dir, runOf(startTime, titles), argv)
const shot = (dir: string, key: string) => fs.readFileSync(path.join(dir, 'debug', `${key}.png`), 'utf8')
const cardsOf = (html: string) => [...html.matchAll(/<span class="name">([^<]*)/g)].map(m => m[1])
const latestOf = (html: string) => [...html.matchAll(/LATEST<\/span><span class="name">([^<]*)/g)].map(m => m[1])
const olderOf = (html: string) => [...html.matchAll(/data-older="1">\s*<div class="hdr">.*?<span class="name">([^<]*)/g)].map(m => m[1])
const T1 = '2026-01-01T00:00:00.000Z'
const T2 = '2026-01-02T00:00:00.000Z'
const T3 = '2026-01-03T00:00:00.000Z'
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'kb-flow-report-'))

test('a run of some tests keeps the other cards, marking only its own as latest', () => {
  const dir = tmp()
  runAt(dir, T1, ['a', 'b'])
  const html = runAt(dir, T2, ['b'])
  assert.deepEqual(cardsOf(html).sort(), ['chat · a', 'chat · b'])
  assert.deepEqual(latestOf(html), ['chat · b'])
  assert.deepEqual(olderOf(html), ['chat · a'])
  assert.equal(shot(dir, 'chat-a'), T1)
  assert.equal(shot(dir, 'chat-b'), T2)
  assert.ok(html.includes(new Date(T1).toLocaleString()))
  assert.match(html, /id="latest-only"(?! disabled)/)
})

test('rebuilding from an older run leaves the newer cards, which stay the latest', () => {
  const dir = tmp()
  runAt(dir, T2, ['a'])
  const html = runAt(dir, T1, ['a', 'b'], ['--prune'])
  assert.equal(shot(dir, 'chat-a'), T2)
  assert.deepEqual(latestOf(html), ['chat · a'])
  assert.deepEqual(olderOf(html), ['chat · b'])
})

test('only --prune drops the older cards a run no longer has, with their files', () => {
  const dir = tmp()
  runAt(dir, T1, ['a', 'gone'])
  assert.deepEqual(cardsOf(runAt(dir, T2, ['a'])).sort(), ['chat · a', 'chat · gone'])
  const html = runAt(dir, T3, ['a'], ['--prune'])
  assert.deepEqual(cardsOf(html), ['chat · a'])
  assert.ok(!fs.existsSync(path.join(dir, 'debug', 'chat-gone.png')))
  assert.match(html, /id="latest-only" disabled/)
})

test('--prune drops only the cards of the variants the run ran: a light run keeps the dark cards', () => {
  const dir = tmp()
  const p = {...platform(dir), variantOf: darkVariantOf}
  const asDark = (results: object) => JSON.parse(JSON.stringify(results).replaceAll('"projectName":"electron"', '"projectName":"electron-dark"')) as object
  const build2 = (results: object, argv: Array<string> = []) => {
    fs.writeFileSync(path.join(dir, 'results.json'), JSON.stringify(results))
    assert.equal(runFlowReport(p, argv), 0)
    return fs.readFileSync(path.join(dir, 'report.html'), 'utf8')
  }
  build2(runOf(T1, ['a', 'gone']))
  build2(asDark(runOf(T2, ['a'])))
  // a full light run drops the light card it no longer has, and keeps the dark one
  assert.deepEqual(cardsOf(build2(runOf(T3, ['a']), ['--prune'])).sort(), ['chat · a', 'chat · a (dark)'])
  // a full dark run keeps the light cards
  assert.deepEqual(cardsOf(build2(asDark(runOf(T3, ['b'])), ['--prune'])).sort(), ['chat · a', 'chat · b (dark)'])
})

test('a test the run skipped keeps its card and screenshots', () => {
  const dir = tmp()
  runAt(dir, T1, ['a'])
  const html = build(dir, runOf(T2, ['a'], ['a']), ['--prune'])
  assert.equal(shot(dir, 'chat-a'), T1)
  assert.ok(fs.existsSync(path.join(dir, 'debug', 'chat-a', 'step-01-manual-a.png')))
  assert.deepEqual(cardsOf(html), ['chat · a'])
})

test("the checklist counts the manual steps of every card, not only this run's", () => {
  const dir = tmp()
  const p = {...platform(dir), manualOnly: {a: {doByHand: 'A by hand.', title: 'A'}, b: {doByHand: 'B by hand.', title: 'B'}}}
  fs.writeFileSync(p.resultsPath, JSON.stringify(runOf(T1, ['a', 'b'])))
  runFlowReport(p, [])
  fs.writeFileSync(p.resultsPath, JSON.stringify(runOf(T2, ['b'])))
  runFlowReport(p, [])
  const checklist = fs.readFileSync(p.checklistPath, 'utf8')
  assert.match(checklist, /debug\/chat-a\/step-01-manual-a\.png/)
  assert.match(checklist, /debug\/chat-b\/step-01-manual-b\.png/)
})

// the run's screenshot named by a path that no longer exists
const withClearedShots = (results: ReturnType<typeof runOf>, dir: string) => {
  for (const att of results.suites[0]!.specs.flatMap(sp => sp.tests.flatMap(t => t.results.flatMap(r => r.attachments as Array<{body?: string; path?: string}>)))) {
    delete att.body
    att.path = path.join(dir, 'cleared', 'screenshot.png')
  }
  return results
}

test("rebuilding a run whose screenshots were cleared keeps the report's copies", () => {
  const dir = tmp()
  runAt(dir, T1, ['a'])
  const html = build(dir, withClearedShots(runOf(T1, ['a']), dir))
  assert.equal(shot(dir, 'chat-a'), T1)
  assert.match(html, /debug\/chat-a\.png/)
})

test("a newer run's cleared screenshot is missing, not the older run's image", () => {
  const dir = tmp()
  runAt(dir, T1, ['a'])
  const html = build(dir, withClearedShots(runOf(T2, ['a']), dir))
  assert.ok(!fs.existsSync(path.join(dir, 'debug', 'chat-a.png')))
  assert.doesNotMatch(html, /debug\/chat-a\.png/)
})

test('run error cards are never hidden by the latest-run filter', () => {
  const dir = tmp()
  runAt(dir, T1, ['a'])
  const html = build(dir, {...runOf(T2, ['b']), errors: [{message: 'worker crashed'}]})
  assert.ok(!olderOf(html).some(n => n?.startsWith('Run error')))
  assert.ok(cardsOf(html).includes('Run error 1'))
})

test('save-baseline copies every card of the report', () => {
  const dir = tmp()
  runAt(dir, T1, ['a', 'b'])
  runAt(dir, T2, ['b'])
  assert.equal(runFlowReport(platform(dir), ['--save-baseline']), 0)
  assert.deepEqual(fs.readdirSync(path.join(dir, 'prev')).sort(), ['chat-a.png', 'chat-b.png'])
})

test('--prune drops nothing when the run broke: a run error, or a test it never reached', () => {
  const dir = tmp()
  runAt(dir, T1, ['a', 'b'])
  const withError = build(dir, {...runOf(T2, ['a']), errors: [{message: 'globalTimeout'}]}, ['--prune'])
  assert.deepEqual(cardsOf(withError).filter(n => n?.startsWith('chat')).sort(), ['chat · a', 'chat · b'])
  const unreached = runOf(T3, ['a', 'b'])
  unreached.suites[0]!.specs[1]!.tests[0]!.results = []
  const html = build(dir, unreached, ['--prune'])
  assert.deepEqual(cardsOf(html).sort(), ['chat · a', 'chat · b'])
  assert.equal(shot(dir, 'chat-b'), T1)
})

test('a store that does not parse stops the build instead of starting over', () => {
  const dir = tmp()
  runAt(dir, T1, ['a'])
  fs.writeFileSync(path.join(dir, 'report.cards.json'), '{"flows": [')
  fs.writeFileSync(path.join(dir, 'results.json'), JSON.stringify(runOf(T2, ['a'])))
  assert.throws(() => runFlowReport(platform(dir), []))
  assert.equal(shot(dir, 'chat-a'), T1)
})
