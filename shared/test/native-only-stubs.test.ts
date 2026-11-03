/// <reference types="jest" />
import * as fs from 'fs'
import * as path from 'path'
import * as Haptics from 'expo-haptics'
import * as Kb from 'react-native-kb'

jest.mock('react-native-kb', () => ({mockedByThisTest: true}))

const nativeOnlyModules = jest.requireActual<Array<string>>('../native-only-modules')

test('mocking one native-only package leaves the others on their own stubs', () => {
  expect(Kb).toHaveProperty('mockedByThisTest', true)
  expect(Haptics).not.toHaveProperty('mockedByThisTest')
  expect(jest.requireActual('react-native-kb')).not.toHaveProperty('mockedByThisTest')
})

test('every native-only package resolves to a stub of its own', () => {
  const resolved = nativeOnlyModules.map(name => require.resolve(name))
  expect(new Set(resolved).size).toBe(nativeOnlyModules.length)
})

test('test/mocks/native holds a stub for exactly the listed packages without one of their own', () => {
  const own = new Set(['@react-native-picker/picker', 'expo-glass-effect', 'react-native-safe-area-context'])
  const files = fs.readdirSync(path.join(__dirname, 'mocks/native')).sort()
  const expected = nativeOnlyModules.filter(name => !own.has(name)).map(name => `${name.replace(/\//g, '__')}.js`)
  expect(files).toEqual(expected.sort())
})
