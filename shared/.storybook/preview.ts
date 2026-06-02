import React from 'react'
import type {Preview} from '@storybook/react'
import type {KB2} from '../util/electron'
import {initDesktopStyles} from '@/styles'

// Inject a minimal KB2 stub so util/electron.tsx's getStashed() doesn't throw.
// The real app sets this from the Electron preload script; storybook sets it here.
const kb2Stub: KB2 = {
  constants: {
    assetRoot: '/',
    configOverload: {},
    dokanPath: '',
    downloadFolder: '',
    env: {
      APPDATA: '',
      HOME: '/tmp',
      KEYBASE_AUTOSTART: '',
      KEYBASE_CRASH_REPORT: '',
      KEYBASE_DEVEL_USE_XDG: '',
      KEYBASE_RESTORE_UI: '',
      KEYBASE_RUN_MODE: 'prod',
      KEYBASE_START_UI: '',
      KEYBASE_XDG_OVERRIDE: '',
      LANG: 'en_US.UTF-8',
      LC_ALL: '',
      LC_TIME: '',
      LOCALAPPDATA: '',
      XDG_CACHE_HOME: '',
      XDG_CONFIG_HOME: '',
      XDG_DATA_HOME: '',
      XDG_DOWNLOAD_DIR: '',
      XDG_RUNTIME_DIR: '',
    },
    helloDetails: {argv: [], clientType: 2 as const, desc: 'Main Renderer', pid: 0, version: ''},
    isRenderer: true,
    pathSep: '/' as const,
    platform: 'darwin' as const,
    startDarkMode: false,
    windowsBinPath: '',
  },
  functions: {
    mainWindowDispatch: () => {},
  },
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
;(globalThis as any)._fromPreload = kb2Stub

initDesktopStyles()

const preview: Preview = {
  decorators: [
    Story =>
      React.createElement('div', {style: {background: '#ffffff', padding: 16}}, React.createElement(Story)),
  ],
  parameters: {
    layout: 'fullscreen',
  },
}

export default preview
