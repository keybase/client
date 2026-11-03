import {APP_LOG_LINE_MAX, APP_LOG_MAX, appLogCaptureBody, appLogMarkerBody, appLogReadBody, linesBefore, readSince, type AppLogRead} from './app-log-lib'

// The app's logger where it matters: one object whose level methods callers look up at each call.
const fakeRuntime = () => {
  const printed: Array<string> = []
  const logger: Record<string, (...a: Array<unknown>) => void> = {}
  for (const level of ['error', 'warn', 'info', 'action', 'debug']) logger[level] = (...a) => void printed.push(`${level}: ${a.join(' ')}`)
  const g: Record<string, unknown> = {__kbE2ERuntime: 'r1'}
  const kbModule = (p: string) => {
    if (p !== 'logger/index.tsx') throw new Error(`no module ${p}`)
    return {default: logger}
  }
  const run = <R,>(body: string) =>
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    (new Function('globalThis', 'kbModule', body) as (...a: Array<unknown>) => R)(g, kbModule)
  return {g, logger, printed, run}
}

test('the capture keeps every level the app logs, in order, and still logs them', () => {
  const rt = fakeRuntime()
  const mark = rt.run<{runtime: string; seq: number}>(appLogCaptureBody)
  expect(mark).toEqual({runtime: 'r1', seq: 0})
  rt.logger['info']?.('[AccountLink] switching', 1)
  rt.logger['warn']?.('careful')
  const got = rt.run<AppLogRead>(appLogReadBody(0))
  expect(got).toEqual({first: 0, lines: ['info [AccountLink] switching 1', 'warn careful'], next: 2, runtime: 'r1'})
  expect(rt.printed).toEqual(['info: [AccountLink] switching 1', 'warn: careful'])
})

test("each level's wrapper is made in its own function: no for loop in the eval body", () => {
  // Hermes, unlike node, shares one binding among the closures a Metro eval's for loop makes
  expect(appLogCaptureBody).not.toMatch(/\bfor\s*\(/)
})

test('installing again in the same runtime wraps nothing twice and keeps what it holds', () => {
  const rt = fakeRuntime()
  rt.run(appLogCaptureBody)
  rt.logger['info']?.('one')
  expect(rt.run(appLogCaptureBody)).toEqual({runtime: 'r1', seq: 1})
  rt.logger['info']?.('two')
  expect(rt.run<AppLogRead>(appLogReadBody(0)).lines).toEqual(['info one', 'info two'])
  expect(rt.printed).toEqual(['info: one', 'info: two'])
})

test('a mark reads only what came after it', () => {
  const rt = fakeRuntime()
  rt.run(appLogCaptureBody)
  rt.logger['info']?.('before')
  const {seq} = rt.run<{seq: number}>(appLogCaptureBody)
  rt.logger['info']?.('after')
  expect(readSince({runtime: 'r1', seq}, rt.run<AppLogRead>(appLogReadBody(seq)))).toEqual(['info after'])
})

test('a read after a reload, or past what the capture still holds, throws instead of reading short', () => {
  const rt = fakeRuntime()
  rt.run(appLogCaptureBody)
  for (let i = 0; i < APP_LOG_MAX + 5; i++) rt.logger['debug']?.(`line ${i}`)
  const r = rt.run<AppLogRead>(appLogReadBody(0))
  expect(r.lines).toHaveLength(APP_LOG_MAX)
  expect(() => readSince({runtime: 'r1', seq: 0}, r)).toThrow(/dropped/)
  expect(readSince({runtime: 'r1', seq: 5}, rt.run<AppLogRead>(appLogReadBody(5)))).toHaveLength(APP_LOG_MAX)
  expect(() => readSince({runtime: 'r1', seq: 5}, {...r, runtime: 'r2'})).toThrow(/reloaded/)
  expect(() => readSince({runtime: 'r1', seq: 5}, {...r, runtime: null})).toThrow(/reloaded/)
})

test("the marker is a stamped line written through the app's own logger", () => {
  const rt = fakeRuntime()
  rt.run(appLogCaptureBody)
  rt.run(appLogMarkerBody('e2e-0abc12-log-fg-1a2b3c4d'))
  expect(rt.run<AppLogRead>(appLogReadBody(0)).lines).toEqual(['info e2e-0abc12-log-fg-1a2b3c4d'])
  expect(() => appLogMarkerBody('hello testuser')).toThrow(/^refusing /)
})

describe('an absence anchored by the marker', () => {
  const marker = 'e2e-0abc12-log-push-1a2b3c4d'

  test('is read from the lines before the marker, so the window is known to have been captured', () => {
    expect(linesBefore(['info a', `info ${marker}`, 'info [AccountLink] late'], marker)).toEqual(['info a'])
    expect(linesBefore([`info ${marker}`], marker)).toEqual([])
  })

  test('is no answer at all until the marker shows: an empty read proves nothing', () => {
    expect(linesBefore([], marker)).toBeUndefined()
    expect(linesBefore(['info a'], marker)).toBeUndefined()
  })

  test('through the capture: an event before the marker is found, none after it counts', () => {
    const rt = fakeRuntime()
    const mark = rt.run<{runtime: string; seq: number}>(appLogCaptureBody)
    rt.logger['info']?.('[AccountLink] switching')
    rt.run(appLogMarkerBody(marker))
    rt.logger['info']?.('[AccountLink] after the window')
    const before = linesBefore(readSince(mark, rt.run<AppLogRead>(appLogReadBody(mark.seq))), marker)
    expect(before).toEqual(['info [AccountLink] switching'])
  })
})

test('a long line is kept cut to its first 2 KB', () => {
  const rt = fakeRuntime()
  rt.run(appLogCaptureBody)
  rt.logger['info']?.('x'.repeat(10_000))
  const [line] = rt.run<AppLogRead>(appLogReadBody(0)).lines
  expect(APP_LOG_LINE_MAX).toBe(2048)
  expect(line).toBe(`info ${'x'.repeat(APP_LOG_LINE_MAX - 5)}`)
  expect(rt.printed[0]).toHaveLength(10_006)
})
