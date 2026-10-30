/* eslint-disable @typescript-eslint/no-floating-promises -- node:test registers top-level tests; they are not awaited */
import {test} from 'node:test'
import assert from 'node:assert/strict'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import {runCensusCli} from '../shared/gate/census-cli.mts'
import {iosCensusPlatform} from './census-platform.mts'
import {iosReportPlatform} from './report-platform.mts'
import {runFlowReport} from '../shared/gate/flow-report.mts'

const quiet = <T,>(f: () => T): T => {
  const log = console.log
  console.log = () => {}
  try {
    return f()
  } finally {
    console.log = log
  }
}

const writeResults = (dir: string, surfaces: Array<string>) => {
  const coverage = {rpcs: [], routes: [], startRoutes: [], surfaces}
  const result = {
    suites: [
      {
        specs: [
          {
            file: 'flows/a.test.ts',
            ok: true,
            tests: [
              {
                projectName: 'ios-flows',
                results: [
                  {attachments: [{body: Buffer.from(JSON.stringify(coverage)).toString('base64'), name: 'coverage.json'}], duration: 5, status: 'passed'},
                ],
                status: 'expected',
              },
            ],
            title: 'a flow',
          },
        ],
        title: 'flows/a.test.ts',
      },
    ],
  }
  const file = path.join(dir, 'results.json')
  fs.writeFileSync(file, JSON.stringify(result))
  return file
}

test('the census names the surfaces and exits 1 while one is unclaimed', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kb-ios-census-'))
  const results = writeResults(dir, ['deep-link'])
  const code = quiet(() =>
    runCensusCli({...iosCensusPlatform, defaultResults: results, resultsDir: dir}, ['--no-render'])
  )
  assert.equal(code, 1)
  const md = fs.readFileSync(path.join(dir, 'ios-census.md'), 'utf8')
  assert.match(md, /deep-link/)
  assert.match(md, /share-extension/)
  assert.ok(fs.existsSync(path.join(dir, 'ios-census.json')))
})

test('the report writes the html with the title and the manual checklist', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kb-ios-report-'))
  const resultsPath = writeResults(dir, [])
  const code = quiet(() =>
    runFlowReport(
      {
        ...iosReportPlatform,
        checklistPath: path.join(dir, 'checklist.md'),
        debugDir: path.join(dir, 'debug'),
        outputPath: path.join(dir, 'report.html'),
        prevDir: path.join(dir, 'prev'),
        resultsPath,
      },
      []
    )
  )
  assert.ok(code === 0 || code === 1)
  assert.match(fs.readFileSync(path.join(dir, 'report.html'), 'utf8'), /a flow/)
  assert.match(fs.readFileSync(path.join(dir, 'report.html'), 'utf8'), /Keybase iOS release gate/)
  assert.ok(fs.readFileSync(path.join(dir, 'checklist.md'), 'utf8').length > 0)
})
