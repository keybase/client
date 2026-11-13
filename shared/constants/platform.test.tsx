jest.mock('@/util/electron', () => ({
  __esModule: true,
  default: {
    constants: {
      env: {
        APPDATA: '\\\\server\\profiles\\\\test\\Roaming\\',
        KEYBASE_RUN_MODE: 'prod',
        LOCALAPPDATA: 'C:\\Users\\test\\AppData\\Local',
      },
      pathSep: '\\',
      platform: 'win32',
    },
  },
}))

import {cacheRoot, dataRoot, socketPath} from './platform'

it('preserves the Windows named-pipe namespace when locating the service', () => {
  expect(socketPath).toBe('\\\\.\\pipe\\kbservice\\Users\\test\\AppData\\Local\\Keybase\\keybased.sock')
})

it('keeps ordinary Windows data paths normalized', () => {
  expect(dataRoot).toBe('C:\\Users\\test\\AppData\\Local\\Keybase\\')
})

it('preserves the UNC prefix while collapsing repeated separators within a network path', () => {
  expect(cacheRoot).toBe('\\\\server\\profiles\\test\\Roaming\\Keybase\\')
})
