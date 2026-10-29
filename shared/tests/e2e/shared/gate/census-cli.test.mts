/* eslint-disable @typescript-eslint/no-floating-promises -- node:test registers top-level tests; they are not awaited */
import {test} from 'node:test'
import assert from 'node:assert/strict'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import {runCensusCli, type CensusPlatform} from './census-cli.mts'

const fixture = (routeCovered: boolean) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kb-census-cli-'))
  const coverage = {routes: routeCovered ? ['routeA'] : [], rpcs: [], startRoutes: []}
  const report = {
    suites: [
      {
        specs: [
          {
            file: 'a.spec.ts',
            title: 'one',
            tests: [
              {
                projectName: 'proj',
                results: [{attachments: [{body: Buffer.from(JSON.stringify(coverage)).toString('base64'), name: 'coverage.json'}], status: 'passed'}],
              },
            ],
          },
        ],
      },
    ],
  }
  const results = path.join(dir, 'results.json')
  fs.writeFileSync(results, JSON.stringify(report))
  const platform: CensusPlatform = {
    defaultResults: results,
    enabledRpcs: () => [],
    exclusions: {routes: {}, rpcs: {}},
    flowsCommand: 'yarn flows',
    manualOnly: {},
    outPrefix: 'x-',
    platform: 'test',
    project: 'proj',
    resultsDir: dir,
    routes: () => [{file: 'f', hasParams: false, modal: false, name: 'routeA'}],
    surfaces: () => ({entryPrefix: 'panel/', existing: [], listFile: 'panels.ts', listed: [], noun: 'panel'}),
  }
  return {dir, platform}
}

const quiet = <T,>(f: () => T): T => {
  const log = console.log
  console.log = () => {}
  try {
    return f()
  } finally {
    console.log = log
  }
}

test('a covered route exits 0 and writes the prefixed census files', () => {
  const {dir, platform} = fixture(true)
  assert.equal(quiet(() => runCensusCli(platform, ['--no-render'])), 0)
  assert.match(fs.readFileSync(path.join(dir, 'x-census.md'), 'utf8'), /routeA/)
  const json = JSON.parse(fs.readFileSync(path.join(dir, 'x-census.json'), 'utf8')) as Record<string, unknown>
  assert.ok('panels' in json && 'unclaimedPanels' in json && 'stalePanels' in json)
})

test('an unclaimed route exits 1', () => {
  const {platform} = fixture(false)
  assert.equal(quiet(() => runCensusCli(platform, ['--no-render'])), 1)
})
