/// <reference types="jest" />
import {resetAllStores} from '../../util/zustand'
import {installFakeEngine} from '@/test/fake-engine'
import {settle} from '@/test/flush'
import {useDarkModeState} from '../darkmode'

jest.mock('@/util/electron', () => ({
  __esModule: true,
  default: {
    constants: {
      env: {},
      pathSep: '/',
      platform: 'darwin',
    },
    functions: {
      setNativeTheme: jest.fn(),
    },
  },
}))

const mockSetNativeTheme = require('@/util/electron').default.functions.setNativeTheme as jest.Mock

afterEach(() => {
  mockSetNativeTheme.mockClear()
  resetAllStores()
})

test('dark mode preference drives isDarkMode and resets with the stored overrides', async () => {
  const {dispatch} = useDarkModeState.getState()

  dispatch.setSystemSupported(true)
  dispatch.setSystemDarkMode(true)
  expect(useDarkModeState.getState().isDarkMode()).toBe(true)

  dispatch.setDarkModePreference('alwaysLight', false)
  await Promise.resolve()
  await Promise.resolve()

  expect(useDarkModeState.getState().darkModePreference).toBe('alwaysLight')
  expect(useDarkModeState.getState().isDarkMode()).toBe(false)
  expect(mockSetNativeTheme).toHaveBeenCalledWith('light')

  dispatch.resetState()
  expect(useDarkModeState.getState()).toMatchObject({
    darkModePreference: 'alwaysLight',
    supported: true,
    systemDarkMode: true,
  })
})

test('loading the stored preference applies it to the native theme without writing it back', async () => {
  const fake = installFakeEngine()
  fake.answer('keybase.1.config.guiGetValue', () => ({isNull: false, s: 'alwaysDark'}))

  useDarkModeState.getState().dispatch.loadDarkPrefs()
  await settle()

  expect(useDarkModeState.getState().darkModePreference).toBe('alwaysDark')
  expect(mockSetNativeTheme).toHaveBeenCalledWith('dark')
  // a write back would reach the service as keybase.1.config.guiSetValue
  expect(fake.calls.map(c => c.method)).toEqual(['keybase.1.config.guiGetValue'])
})
