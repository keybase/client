/// <reference types="jest" />
import {resetAllStores} from '../../util/zustand'
import * as T from '@/constants/types'
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
  const getValue = jest
    .spyOn(T.RPCGen, 'configGuiGetValueRpcPromise')
    .mockResolvedValue({isNull: false, s: 'alwaysDark'} as T.RPCGen.ConfigValue)
  const setValue = jest.spyOn(T.RPCGen, 'configGuiSetValueRpcPromise').mockResolvedValue(undefined)

  useDarkModeState.getState().dispatch.loadDarkPrefs()
  await new Promise(resolve => setTimeout(resolve, 0))

  expect(useDarkModeState.getState().darkModePreference).toBe('alwaysDark')
  expect(mockSetNativeTheme).toHaveBeenCalledWith('dark')
  expect(setValue).not.toHaveBeenCalled()
  getValue.mockRestore()
  setValue.mockRestore()
})
