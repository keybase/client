/// <reference types="jest" />
// react-native-kb's JS wrapper (rnmodules/react-native-kb/src/index.tsx) over a fake Kb TurboModule.
import {Platform} from 'react-native'
import {
  checkPushPermissions,
  onHWKeyPressed,
  processMedia,
  registerPasteImage,
  removeOnHWKeyPressed,
  version,
} from 'react-native-kb'
import {fakeNativeKb, type FakeNativeKbModule} from './fake-native-kb'

jest.mock('react-native-kb', () => jest.requireActual<FakeNativeKbModule>('@/test/fake-native-kb').realKb({version: '1.2.3'}))

const pasteEnabled = new Array<boolean>()
const nativeProcessMedia = jest.fn(async () => Promise.resolve('/tmp/out.mp4'))

beforeEach(() => {
  pasteEnabled.length = 0
  nativeProcessMedia.mockClear()
  fakeNativeKb.give({
    processMedia: nativeProcessMedia,
    setEnablePasteImage: (enabled: boolean) => {
      pasteEnabled.push(enabled)
    },
  })
})

afterEach(() => {
  jest.restoreAllMocks()
})

test('the constants are what native reports as the module loads', () => {
  expect(version).toBe('1.2.3')
})

test('a native method the test did not give throws rather than answering', async () => {
  await expect(async () => checkPushPermissions()).rejects.toThrow('NativeKb.checkPushPermissions is not faked')
})

test('processMedia asks native on iOS, filling the defaults', async () => {
  jest.replaceProperty(Platform, 'OS', 'ios')
  await expect(processMedia('/tmp/in.mov', true, true)).resolves.toBe('/tmp/out.mp4')
  expect(nativeProcessMedia).toHaveBeenCalledWith('/tmp/in.mov', true, true, 0, 0, false, false)
})

test('processMedia hands the path back off iOS without asking native', async () => {
  jest.replaceProperty(Platform, 'OS', 'android')
  await expect(processMedia('/tmp/in.mov', true, true)).resolves.toBe('/tmp/in.mov')
  expect(nativeProcessMedia).not.toHaveBeenCalled()
})

test('paste image stays enabled until the last registration is removed', () => {
  jest.replaceProperty(Platform, 'OS', 'ios')
  const got = new Array<Array<string>>()
  const stopA = registerPasteImage(uris => got.push(uris))
  const stopB = registerPasteImage(() => {})
  expect(fakeNativeKb.count('onPasteImage')).toBe(2)

  fakeNativeKb.emit('onPasteImage', ['file:///a.png'])
  expect(got).toEqual([['file:///a.png']])

  stopA()
  expect(pasteEnabled).toEqual([true, true, true])
  stopB()
  expect(pasteEnabled).toEqual([true, true, true, false])
  expect(fakeNativeKb.count('onPasteImage')).toBe(0)
})

test('paste image is not registered off iOS', () => {
  jest.replaceProperty(Platform, 'OS', 'android')
  registerPasteImage(() => {})()
  expect(fakeNativeKb.count('onPasteImage')).toBe(0)
  expect(pasteEnabled).toEqual([])
})

test('removeOnHWKeyPressed removes every hardware key subscription', () => {
  const keys = new Array<string>()
  onHWKeyPressed(e => keys.push(e.pressedKey))
  onHWKeyPressed(e => keys.push(`second ${e.pressedKey}`))
  fakeNativeKb.emit('onHardwareKeyPressed', 'enter')
  expect(keys).toEqual(['enter', 'second enter'])

  removeOnHWKeyPressed()
  fakeNativeKb.emit('onHardwareKeyPressed', 'enter')
  expect(fakeNativeKb.count('onHardwareKeyPressed')).toBe(0)
  expect(keys).toEqual(['enter', 'second enter'])
})
