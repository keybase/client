import type {KB2} from '../../util/electron'

const stub: KB2 = {
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

export default stub
export const injectPreload = () => {}
export const waitOnKB2Loaded = (cb: () => void) => cb()
