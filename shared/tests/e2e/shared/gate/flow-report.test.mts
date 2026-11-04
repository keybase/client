/* eslint-disable @typescript-eslint/no-floating-promises -- node:test registers top-level tests; they are not awaited */
import {test} from 'node:test'
import assert from 'node:assert/strict'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import {runFlowReport, type FlowReportPlatform} from './flow-report.mts'

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

test('without variantOf every project of a spec is keyed and labelled by the spec alone and takes the known verdict', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kb-flow-report-'))
  fs.writeFileSync(path.join(dir, 'results.json'), JSON.stringify(twoProjectResults()))
  const p = {...platform(dir), known}
  assert.equal(runFlowReport(p, []), 0)
  assert.deepEqual(fs.readdirSync(p.debugDir), ['inbox-sends-a-message.png'])
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

// a run at `startTime` of the named passing tests, each with a screenshot whose bytes name the run
const runOf = (startTime: string, titles: Array<string>) => ({
  stats: {startTime},
  suites: [
    {
      specs: titles.map(title => ({
        file: 'flows/chat.test.ts',
        ok: true,
        tests: [
          {
            projectName: 'electron',
            results: [{attachments: [{body: Buffer.from(startTime).toString('base64'), contentType: 'image/png', name: 'screenshot'}], duration: 5, status: 'passed'}],
            status: 'expected',
          },
        ],
        title,
      })),
      title: 'flows/chat.test.ts',
    },
  ],
})
const runAt = (dir: string, startTime: string, titles: Array<string>, argv: Array<string>) => {
  fs.writeFileSync(path.join(dir, 'results.json'), JSON.stringify(runOf(startTime, titles)))
  assert.equal(runFlowReport(platform(dir), argv), 0)
  return fs.readFileSync(path.join(dir, 'report.html'), 'utf8')
}
const shot = (dir: string, key: string) => fs.readFileSync(path.join(dir, 'debug', `${key}.png`), 'utf8')
const cardsOf = (html: string) => [...html.matchAll(/<span class="name">([^<]*)/g)].map(m => m[1])
const freshOf = (html: string) => [...html.matchAll(/data-fresh="1">\s*<div class="hdr">.*?<span class="name">([^<]*)/g)].map(m => m[1])

test('a targeted run keeps the cards it lacks and marks only its own as this run', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kb-flow-report-'))
  runAt(dir, '2026-01-01T00:00:00.000Z', ['a', 'b'], [])
  const html = runAt(dir, '2026-01-02T00:00:00.000Z', ['b'], ['--targeted'])
  assert.deepEqual(cardsOf(html).sort(), ['chat · a', 'chat · b'])
  assert.deepEqual(freshOf(html), ['chat · b'])
  assert.equal(shot(dir, 'chat-a'), '2026-01-01T00:00:00.000Z')
  assert.equal(shot(dir, 'chat-b'), '2026-01-02T00:00:00.000Z')
  assert.ok(html.includes(new Date('2026-01-01T00:00:00.000Z').toLocaleString()))
  assert.match(html, /id="latest-only"(?! disabled)/)
})

test('rebuilding from an older run leaves the newer cards and their screenshots', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kb-flow-report-'))
  runAt(dir, '2026-01-02T00:00:00.000Z', ['a'], ['--targeted'])
  const html = runAt(dir, '2026-01-01T00:00:00.000Z', ['a', 'b'], [])
  assert.equal(shot(dir, 'chat-a'), '2026-01-02T00:00:00.000Z')
  assert.deepEqual(freshOf(html), ['chat · b'])
})

test('a full run drops the older cards it no longer has; a targeted run drops nothing', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kb-flow-report-'))
  runAt(dir, '2026-01-01T00:00:00.000Z', ['a', 'gone'], [])
  assert.deepEqual(cardsOf(runAt(dir, '2026-01-02T00:00:00.000Z', ['a'], ['--targeted'])).sort(), ['chat · a', 'chat · gone'])
  const html = runAt(dir, '2026-01-03T00:00:00.000Z', ['a'], [])
  assert.deepEqual(cardsOf(html), ['chat · a'])
  assert.ok(!fs.existsSync(path.join(dir, 'debug', 'chat-gone.png')))
  assert.match(html, /id="latest-only" disabled/)
})

test("a screenshot the run's results no longer have keeps the report's copy", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kb-flow-report-'))
  runAt(dir, '2026-01-01T00:00:00.000Z', ['a'], [])
  const gone = runOf('2026-01-01T00:00:00.000Z', ['a'])
  const att = gone.suites[0]!.specs[0]!.tests[0]!.results[0]!.attachments[0]! as {body?: string; path?: string}
  delete att.body
  att.path = path.join(dir, 'cleared', 'screenshot.png')
  fs.writeFileSync(path.join(dir, 'results.json'), JSON.stringify(gone))
  assert.equal(runFlowReport(platform(dir), []), 0)
  assert.equal(shot(dir, 'chat-a'), '2026-01-01T00:00:00.000Z')
  assert.match(fs.readFileSync(path.join(dir, 'report.html'), 'utf8'), /debug\/chat-a\.png/)
})
