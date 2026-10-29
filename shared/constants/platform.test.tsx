jest.mock('@/util/electron', () => ({
  __esModule: true,
  default: {
    constants: {
      env: {
        APPDATA: 'C:\\Users\\test\\AppData\\Roaming',
        KEYBASE_RUN_MODE: 'prod',
        LOCALAPPDATA: 'C:\\Users\\test\\AppData\\Local',
      },
      pathSep: '\\',
      platform: 'win32',
    },
  },
}))

import {dataRoot, socketPath} from './platform'

it('preserves the Windows named-pipe namespace when locating the service', () => {
  expect(socketPath).toBe('\\\\.\\pipe\\kbservice\\Users\\test\\AppData\\Local\\Keybase\\keybased.sock')
})

it('keeps ordinary Windows data paths normalized', () => {
  expect(dataRoot).toBe('C:\\Users\\test\\AppData\\Local\\Keybase\\')
})
