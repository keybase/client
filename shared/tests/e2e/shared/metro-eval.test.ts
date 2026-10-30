import {findModuleId, NO_INSPECTOR_PAGE, pickInspectorPage} from './metro-eval'

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
