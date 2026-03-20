/// <reference types="jest" />
import {resetAllStores} from '../../util/zustand'
import {useDarkModeState} from '../darkmode'

jest.mock('@/util/electron.desktop', () => ({
  __esModule: true,
  default: {
    constants: {
      env: {},
      platform: 'darwin',
    },
    functions: {
      setNativeTheme: jest.fn(),
    },
  },
}))

const mockSetNativeTheme = require('@/util/electron.desktop').default.functions.setNativeTheme as jest.Mock

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

  dispatch.resetState?.()
  expect(useDarkModeState.getState()).toMatchObject({
    darkModePreference: 'alwaysLight',
    supported: true,
    systemDarkMode: true,
  })
})
