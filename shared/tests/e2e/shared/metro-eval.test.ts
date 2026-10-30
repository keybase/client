import {findModuleId, NO_INSPECTOR_PAGE, pickInspectorPage, waitForInspectorPage, type WaitClock} from './metro-eval'

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
  await expect(waitForInspectorPage(async () => Promise.resolve(found), 'reading', {clock, intervalMs: 500, ms: 15_000})).resolves.toBe(found)
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
  await expect(waitForInspectorPage(lookup, 'reading', {clock, intervalMs: 500, ms: 15_000})).resolves.toBe(found)
  expect(calls).toBe(5)
  expect(sleeps).toEqual([500, 500, 500, 500])
})

test('a page that never comes back fails once, at the bound, naming the step', async () => {
  const {clock, sleeps, tick} = fakeClock(100)
  const lookup = async () => {
    tick()
    return Promise.reject(new Error(`${NO_INSPECTOR_PAGE} for iPhoneTest (Metro lists nothing)`))
  }
  await expect(waitForInspectorPage(lookup, 'reading the router state', {clock, intervalMs: 500, ms: 15_000})).rejects.toThrow(
    `reading the router state: ${NO_INSPECTOR_PAGE} for iPhoneTest (Metro lists nothing)`
  )
  // 600ms per try (100ms lookup, 500ms sleep): the try at 15.0s still fails, the one past it stops
  expect(clock.now()).toBeGreaterThanOrEqual(1000 + 15_000)
  expect(clock.now()).toBeLessThan(1000 + 15_000 + 600)
  expect(sleeps.length).toBe(25)
})
