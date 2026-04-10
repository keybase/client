const {enableMapSet, setUseStrictIteration} = require('immer')
const {TextDecoder, TextEncoder} = require('util')

enableMapSet()
setUseStrictIteration(false)

global.TextDecoder = global.TextDecoder || TextDecoder
global.TextEncoder = global.TextEncoder || TextEncoder

global.__DEV__ = false
global.__FILE_SUFFIX__ = '.desktop'
global.__HOT__ = false
global.__PROFILE__ = false
global.__STORYBOOK__ = false
global.__VERSION__ = 'test'

global._fromPreload = {
  constants: {
    assetRoot: '',
    configOverload: {},
    dokanPath: '',
    downloadFolder: '/tmp',
    env: {
      APPDATA: '',
      HOME: '/tmp',
      KEYBASE_AUTOSTART: '',
      KEYBASE_CRASH_REPORT: '',
      KEYBASE_DEVEL_USE_XDG: '',
      KEYBASE_RESTORE_UI: '',
      KEYBASE_RUN_MODE: '',
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
    helloDetails: {
      argv: [],
      clientType: 2,
      desc: 'Main Renderer',
      pid: 1,
      version: 'test',
    },
    isRenderer: true,
    pathSep: '/',
    platform: 'darwin',
    startDarkMode: false,
    windowsBinPath: '',
  },
  functions: {
    mainWindowDispatch: () => {},
  },
}
