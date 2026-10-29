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
