// implementation of KB2, requires node context! preload will proxy this with the contextBridge
import {app, nativeTheme} from 'electron'
import os from 'os'
import path from 'path'
import type {KB2} from '../../util/electron.desktop'
const {env, argv, pid} = process

const platform = process.platform
if (platform !== 'win32' && platform !== 'darwin' && platform !== 'linux') {
  throw new Error('Invalid platform: ' + platform)
}
const pathSep = path.sep
if (pathSep !== '/' && pathSep !== '\\') {
  throw new Error('Invalid path sep:' + pathSep)
}

const kb2: KB2['constants'] = {
  assetRoot: path.resolve(__DEV__ || __PROFILE__ ? '.' : app.getAppPath()).replaceAll('\\', '/') + '/',
  configOverload: {}, // filled in later
  dokanPath: path.resolve(env.LOCALAPPDATA ?? '', 'Keybase', 'DokanSetup_redist.exe'),
  downloadFolder: path.join(os.homedir(), 'Downloads'),
  env: {
    APPDATA: env['APPDATA'] ?? '',
    HOME: env['HOME'] ?? '',
    KEYBASE_AUTOSTART: env['KEYBASE_AUTOSTART'] ?? '',
    KEYBASE_CRASH_REPORT: env['KEYBASE_CRASH_REPORT'] ?? '',
    KEYBASE_DEVEL_USE_XDG: env['KEYBASE_DEVEL_USE_XDG'] ?? '',
    KEYBASE_RESTORE_UI: env['KEYBASE_RESTORE_UI'] ?? '',
    KEYBASE_RUN_MODE: env['KEYBASE_RUN_MODE'] || 'prod',
    KEYBASE_START_UI: env['KEYBASE_XDG_OVERRIDE'] ?? '',
    KEYBASE_XDG_OVERRIDE: env['KEYBASE_XDG_OVERRIDE'] ?? '',
    LANG: env['LANG'] ?? '',
    LC_ALL: env['LC_ALL'] ?? '',
    LC_TIME: env['LC_TIME'] ?? '',
    LOCALAPPDATA: env['LOCALAPPDATA'] ?? '',
    XDG_CACHE_HOME: env['XDG_CACHE_HOME'] ?? '',
    XDG_CONFIG_HOME: env['XDG_CONFIG_HOME'] ?? '',
    XDG_DATA_HOME: env['XDG_DATA_HOME'] ?? '',
    XDG_DOWNLOAD_DIR: env['XDG_DOWNLOAD_DIR '] ?? '',
    XDG_RUNTIME_DIR: env['XDG_RUNTIME_DIR'] ?? '',
  },
  helloDetails: {
    argv,
    clientType: 2, // RPCTypes.ClientType.guiMain,
    desc: 'Main Renderer',
    pid,
    version: __VERSION__,
  },
  isRenderer: process.type === 'renderer',
  pathSep,
  platform,
  startDarkMode: nativeTheme.shouldUseDarkColors,
  windowsBinPath: path.resolve(env.LOCALAPPDATA ?? '', 'Keybase', 'keybase.exe'),
}

export default kb2
