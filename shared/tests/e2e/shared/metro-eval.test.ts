import {
  evalInPage,
  findModuleId,
  INSPECTOR_CLOSED,
  lostInspectorPage,
  NO_INSPECTOR_PAGE,
  pickInspectorPage,
  retryFor,
  WITHHELD_LINE,
  whileLost,
  withholdQuotedCode,
  type WaitClock,
} from './metro-eval'

const mods = (...names: Array<string>): Array<[number, {verboseName?: string}]> => names.map((verboseName, i) => [i, {verboseName}])
const TIS = 'node_modules/react-native/Libraries/Components/TextInput/TextInputState.js'

test('an exact verboseName wins over a suffix match', () => {
  expect(findModuleId(mods(`../../client/shared/${TIS}`, TIS), TIS)).toBe(1)
})

test('a node_modules name matches a verboseName from a symlinked checkout', () => {
  expect(findModuleId(mods('a.js', `../../client/shared/${TIS}`), TIS)).toBe(1)
})

test('a suffix match needs a path boundary and only applies to node_modules names', () => {
  expect(findModuleId(mods(`xnode_modules/react-native/a.js`), 'node_modules/react-native/a.js')).toBeUndefined()
  expect(findModuleId(mods('../other/constants/foo.tsx'), 'constants/foo.tsx')).toBeUndefined()
  expect(findModuleId(mods('constants/foo.tsx'), 'constants/foo.tsx')).toBe(0)
})

test('modules without a verboseName never match', () => {
  expect(findModuleId([[0, {}]], TIS)).toBeUndefined()
})

test('more than one suffix match throws instead of picking one', () => {
  expect(() => findModuleId(mods(`../a/${TIS}`, `../b/${TIS}`), TIS)).toThrow(`ambiguous module ${TIS}: 2 matches`)
  expect(findModuleId(mods(`../a/${TIS}`, TIS, `../b/${TIS}`), TIS)).toBe(1)
})

const page = (deviceName: string, appId: string, title: string) => ({appId, deviceName, title, webSocketDebuggerUrl: `ws://x/${title}`})

test('the newest page for the device and app is picked', () => {
  const pages = [page('iPhoneTest', 'keybase.ios', 'a'), page('iPadTest', 'keybase.ios', 'b'), page('iPhoneTest', 'keybase.ios', 'c')]
  expect(pickInspectorPage(pages, 'iPhoneTest', 'keybase.ios').title).toBe('c')
})

test('an empty target list says Metro lists nothing', () => {
  expect(() => pickInspectorPage([], 'iPhoneTest', 'keybase.ios')).toThrow(
    `${NO_INSPECTOR_PAGE} for iPhoneTest (Metro lists nothing)`
  )
})

test('a list with only other targets names each of them', () => {
  const pages = [page('iPadTest', 'keybase.ios', 'Hermes'), {webSocketDebuggerUrl: 'ws://y'}]
  expect(() => pickInspectorPage(pages, 'iPhoneTest', 'keybase.ios')).toThrow(
    `${NO_INSPECTOR_PAGE} for iPhoneTest (Metro lists iPadTest/keybase.ios/Hermes, ?/?/?)`
  )
})

// A clock that only moves when the wait sleeps (plus `lookupMs` per lookup).
const fakeClock = (lookupMs = 0) => {
  let t = 1000
  const sleeps: Array<number> = []
  const clock: WaitClock = {
    now: () => t,
    sleep: async ms => {
      sleeps.push(ms)
      t += ms
      return Promise.resolve()
    },
  }
  return {clock, sleeps, tick: () => (t += lookupMs)}
}

test('the page wait returns as soon as a lookup finds the page, without sleeping', async () => {
  const {clock, sleeps} = fakeClock()
  const found = page('iPhoneTest', 'keybase.ios', 'a')
  await expect(retryFor(async () => Promise.resolve(found), {clock, intervalMs: 500, ms: 15_000, what: 'reading'})).resolves.toBe(found)
  expect(sleeps).toEqual([])
})

test('the page wait rides out a drop that ends inside its bound', async () => {
  const {clock, sleeps} = fakeClock()
  const found = page('iPhoneTest', 'keybase.ios', 'a')
  let calls = 0
  const lookup = async () => {
    calls++
    return clock.now() < 1000 + 2_000
      ? Promise.reject(new Error(`${NO_INSPECTOR_PAGE} for iPhoneTest (Metro lists nothing)`))
      : Promise.resolve(found)
  }
  await expect(retryFor(lookup, {clock, intervalMs: 500, ms: 15_000, what: 'reading'})).resolves.toBe(found)
  expect(calls).toBe(5)
  expect(sleeps).toEqual([500, 500, 500, 500])
})

test('a page that never comes back fails once, at the bound, naming the step', async () => {
  const {clock, sleeps, tick} = fakeClock(100)
  const lookup = async () => {
    tick()
    return Promise.reject(new Error(`${NO_INSPECTOR_PAGE} for iPhoneTest (Metro lists nothing)`))
  }
  await expect(retryFor(lookup, {clock, intervalMs: 500, ms: 15_000, what: 'reading the router state'})).rejects.toThrow(
    `reading the router state: ${NO_INSPECTOR_PAGE} for iPhoneTest (Metro lists nothing)`
  )
  // 600ms per try (100ms lookup, 500ms sleep): the try at 15.0s still fails, the one past it stops
  expect(clock.now()).toBeGreaterThanOrEqual(1000 + 15_000)
  expect(clock.now()).toBeLessThan(1000 + 15_000 + 600)
  expect(sleeps.length).toBe(25)
})

test('a lost page is a missing page or a debugger socket Metro closed, not a failed or slow eval', () => {
  expect(lostInspectorPage(`reading: ${NO_INSPECTOR_PAGE} for iPhoneTest (Metro lists nothing)`)).toBe(true)
  expect(lostInspectorPage(`switching to tabs.peopleTab: ${INSPECTOR_CLOSED}`)).toBe(true)
  expect(lostInspectorPage('switching to tabs.peopleTab: no answer in 5s')).toBe(false)
  expect(lostInspectorPage('app evaluate threw: Error: no navigation state')).toBe(false)
  expect(lostInspectorPage(undefined)).toBe(false)
})

// A WebSocket the test drives: each new socket is handed to `onSocket`.
const withFakeSocket = async (onSocket: (s: {emit: (type: string, e?: {data?: unknown}) => void}) => void, f: () => Promise<void>) => {
  const g = globalThis as unknown as {WebSocket: unknown}
  const saved = g.WebSocket
  g.WebSocket = class {
    listeners = new Map<string, Array<(e: {data?: unknown}) => void>>()
    constructor() {
      onSocket({emit: (type, e = {}) => this.listeners.get(type)?.forEach(l => l(e))})
    }
    addEventListener(type: string, l: (e: {data?: unknown}) => void) {
      this.listeners.set(type, [...(this.listeners.get(type) ?? []), l])
    }
    close() {}
    send() {}
  }
  try {
    await f()
  } finally {
    g.WebSocket = saved
  }
}
const evalPage = {webSocketDebuggerUrl: 'ws://localhost:8081/inspector/debug?device=d&page=1'}

test('an eval whose debugger socket closes before answering fails at once, saying so', async () => {
  await withFakeSocket(
    s => setTimeout(() => s.emit('close'), 0),
    async () => {
      await expect(evalInPage(evalPage, 'return 1')).rejects.toThrow(INSPECTOR_CLOSED)
    }
  )
})

test('a close after the answer leaves the answer', async () => {
  await withFakeSocket(
    s =>
      setTimeout(() => {
        s.emit('message', {data: JSON.stringify({id: 1, result: {result: {value: 7}}})})
        s.emit('close')
      }, 0),
    async () => {
      await expect(evalInPage(evalPage, 'return 7')).resolves.toBe(7)
    }
  )
})

test('a read is tried again while its socket keeps closing under it, and answers once the page holds', async () => {
  const {clock, sleeps} = fakeClock()
  let calls = 0
  const read = async () => {
    calls++
    return clock.now() < 1000 + 1_500 ? Promise.reject(new Error(`reading the JS runtime token: ${INSPECTOR_CLOSED}`)) : Promise.resolve('tok-1')
  }
  await expect(retryFor(read, {clock, intervalMs: 500, ms: 15_000, retryIf: whileLost})).resolves.toBe('tok-1')
  expect(calls).toBe(4)
  expect(sleeps).toEqual([500, 500, 500])
})

test('a read that fails for another reason is not tried again', async () => {
  const {clock, sleeps} = fakeClock()
  let calls = 0
  const read = async () => {
    calls++
    return Promise.reject(new Error('app evaluate threw: Error: boom'))
  }
  await expect(retryFor(read, {clock, intervalMs: 500, ms: 15_000, retryIf: whileLost})).rejects.toThrow('boom')
  expect(calls).toBe(1)
  expect(sleeps).toEqual([])
})

test('a read whose page stays lost fails at the bound with the last error', async () => {
  const {clock, tick} = fakeClock(100)
  const read = async () => {
    tick()
    return Promise.reject(new Error(`reading: ${NO_INSPECTOR_PAGE} for iPhoneTest (Metro lists nothing)`))
  }
  await expect(retryFor(read, {clock, intervalMs: 500, ms: 15_000, retryIf: whileLost})).rejects.toThrow(NO_INSPECTOR_PAGE)
  expect(clock.now()).toBeGreaterThanOrEqual(1000 + 15_000)
  expect(clock.now()).toBeLessThan(1000 + 15_000 + 600)
})

// The text setPasteboard writes, as a secret would be: a long string inside the body's code.
const SECRET_TEXT = 'https://keybase.io/team/invite/e2e-secret-0123456789abcdef'
const secretBody = `kbModule('x').setStringAsync(${JSON.stringify(SECRET_TEXT)}); return true`

test("a failed eval's error, and anything it logs, repeat none of the code it ran", async () => {
  // the app throws a message built from the code's own data, with a stack, as Hermes reports it
  const description = `Error: refused ${SECRET_TEXT}\n    at anonymous (:1:85)\n    at global (:1:91)`
  const logged: Array<unknown> = []
  const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map(level =>
    jest.spyOn(console, level).mockImplementation((...args: Array<unknown>) => void logged.push(args))
  )
  try {
    await withFakeSocket(
      s =>
        setTimeout(() => {
          const data = JSON.stringify({id: 1, result: {exceptionDetails: {exception: {description}, text: `refused ${SECRET_TEXT}`}}})
          s.emit('message', {data})
        }, 0),
      async () => {
        const err = await evalInPage(evalPage, secretBody).then(
          () => undefined,
          (e: unknown) => e as Error
        )
        expect(err).toBeInstanceOf(Error)
        expect(err?.message).toContain('app evaluate threw: ')
        expect(err?.message).toContain(WITHHELD_LINE)
        expect(err?.message).toContain('at anonymous (:1:85)')
        // no stretch of the secret either, down to a short one
        for (const part of [SECRET_TEXT, secretBody, SECRET_TEXT.slice(-20), 'e2e-secret-0123']) expect(err?.message).not.toContain(part)
        expect(JSON.stringify(err)).not.toContain('e2e-secret')
      }
    )
  } finally {
    spies.forEach(s => s.mockRestore())
  }
  expect(logged).toEqual([])
})

test('a report keeps the lines that repeat no long stretch of the code', () => {
  const code = `const ok = 1; throw new Error('no navigation state')`
  expect(withholdQuotedCode('no navigation state\nError: no navigation state\n    at anonymous (:1:25)', code)).toBe(
    'no navigation state\nError: no navigation state\n    at anonymous (:1:25)'
  )
  expect(withholdQuotedCode(`Error: ${SECRET_TEXT}`, `return ${JSON.stringify(SECRET_TEXT)}`)).toBe(WITHHELD_LINE)
  // a line that carries only a short piece of the code stays
  expect(withholdQuotedCode('Error: e2e-secret', `return ${JSON.stringify(SECRET_TEXT)}`)).toBe('Error: e2e-secret')
  // the app lowercased what it was given before quoting it
  expect(withholdQuotedCode(`Error: ${SECRET_TEXT.toLowerCase()}`, `return ${JSON.stringify(SECRET_TEXT.toUpperCase())}`)).toBe(WITHHELD_LINE)
})
