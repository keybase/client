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
    renderPlatform: 'desktop',
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
  assert.ok('surfaces' in json && 'unclaimedSurfaces' in json && 'staleSurfaces' in json && json['noun'] === 'panel')
})

test('an unclaimed route exits 1', () => {
  const {platform} = fixture(false)
  assert.equal(quiet(() => runCensusCli(platform, ['--no-render'])), 1)
})

const writeRender = (dir: string, stamp: string, platform: string | undefined, routes: Array<string>) => {
  const run = path.join(dir, 'visual/render', stamp)
  fs.mkdirSync(run, {recursive: true})
  const entries = [{id: 'tab/x', routes, startRoutes: [], status: 'ok'}]
  fs.writeFileSync(path.join(run, 'render.json'), JSON.stringify({entries, ...(platform ? {platform} : {})}))
}

test("the census reads its own platform's newest render, past a newer one from the other platform", () => {
  const {dir, platform} = fixture(false)
  writeRender(dir, '2026-01-01T00-00-00', 'ios', ['routeA'])
  writeRender(dir, '2026-01-02T00-00-00', 'desktop', [])
  assert.equal(quiet(() => runCensusCli({...platform, renderPlatform: 'ios'}, [])), 0)
  assert.equal(quiet(() => runCensusCli(platform, [])), 1)
})

test('a render.json without a platform is a desktop render', () => {
  const {dir, platform} = fixture(false)
  writeRender(dir, '2026-01-01T00-00-00', undefined, ['routeA'])
  assert.equal(quiet(() => runCensusCli(platform, [])), 0)
  const err = console.error
  const errors: Array<string> = []
  console.error = (l: string) => errors.push(l)
  try {
    assert.equal(quiet(() => runCensusCli({...platform, renderPlatform: 'ios'}, [])), 1)
  } finally {
    console.error = err
  }
  assert.match(errors.join('\n'), /no ios render\.json under .*: run yarn visual:render --ios first/)
})

test('a render.json that does not parse is skipped and named, and the census reads the next one', () => {
  const {dir, platform} = fixture(false)
  writeRender(dir, '2026-01-01T00-00-00', 'desktop', ['routeA'])
  const broken = path.join(dir, 'visual/render/2026-01-02T00-00-00')
  fs.mkdirSync(broken, {recursive: true})
  fs.writeFileSync(path.join(broken, 'render.json'), '{"entries": [')
  const warn = console.warn
  const warnings: Array<string> = []
  console.warn = (l: string) => warnings.push(l)
  try {
    assert.equal(quiet(() => runCensusCli(platform, [])), 0)
  } finally {
    console.warn = warn
  }
  assert.match(warnings.join('\n'), /census: skipping .*2026-01-02T00-00-00\/render\.json: /)
})
