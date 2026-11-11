/// <reference types="jest" />
import type {KB2} from '@/util/electron'
import type * as Platform from './platform'

const preload = globalThis._fromPreload as KB2
const originalConstants = preload.constants

afterEach(() => {
  preload.constants = originalConstants
})

test.each([
  ['prod', 'Keybase'],
  ['devel', 'KeybaseDevel'],
])('Windows %s socket keeps the named-pipe namespace', (runMode, appName) => {
  preload.constants = {
    ...originalConstants,
    env: {
      ...originalConstants.env,
      APPDATA: 'C:\\Users\\testuser\\AppData\\Roaming',
      KEYBASE_RUN_MODE: runMode,
      LOCALAPPDATA: 'C:\\Users\\testuser\\AppData\\Local',
    },
    pathSep: '\\',
    platform: 'win32',
  }

  jest.isolateModules(() => {
    const platform: typeof Platform = require('./platform')
    expect(platform.socketPath).toBe(
      `\\\\.\\pipe\\kbservice\\Users\\testuser\\AppData\\Local\\${appName}\\keybased.sock`
    )
    expect(platform.guiConfigFilename).toBe(
      `C:\\Users\\testuser\\AppData\\Local\\${appName}\\gui_config.json`
    )
  })
})
