import {findModuleId} from './metro-eval'

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
