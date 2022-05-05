// implementation of KB2, requires node context! preload will proxy this with the contextBridge
import {app} from 'electron'
import path from 'path'
const {env} = process

const kb2 = {
  assetRoot: path.resolve(__DEV__ ? '.' : app.getAppPath()),
  dokanPath: path.resolve(env.LOCALAPPDATA ?? '', 'Keybase', 'DokanSetup_redist.exe'),
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
  windowsBinPath: path.resolve(env.LOCALAPPDATA ?? '', 'Keybase', 'keybase.exe'),
}
export default kb2
