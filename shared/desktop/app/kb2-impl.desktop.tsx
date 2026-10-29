// implementation of KB2, requires node context! preload will proxy this with the contextBridge
import {nativeTheme} from 'electron'
import os from 'os'
import path from 'path'
import type {KB2} from '@/util/electron'
import {pageOrigin} from './html-root.desktop'
import {localFileHost} from './local-file-host.desktop'
const {env, argv, pid} = process

const platform = process.platform
if (platform !== 'win32' && platform !== 'darwin' && platform !== 'linux') {
  throw new Error('Invalid platform: ' + platform)
}
const pathSep = path.sep
const _pathSep = pathSep as string
if (_pathSep !== '/' && _pathSep !== '\\') {
  throw new Error('Invalid path sep:' + _pathSep)
}

const kb2: KB2['constants'] = {
  // The page origin serves /images/...: the Vite dev server in hot dev, the app
  // scheme otherwise.
  assetRoot: `${pageOrigin}/`,
  configOverload: {}, // filled in later
  dokanPath: path.resolve(
    (env['LOCALAPPDATA'] as string | undefined) ?? '',
    'Keybase',
    'DokanSetup_redist.exe'
  ),
  downloadFolder: path.join(os.homedir(), 'Downloads'),
  env: {
    APPDATA: (env['APPDATA'] as string | undefined) ?? '',
    HOME: (env['HOME'] as string | undefined) ?? '',
    KB_E2E_TEST: (env['KB_E2E_TEST'] as string | undefined) ?? '',
    KEYBASE_AUTOSTART: (env['KEYBASE_AUTOSTART'] as string | undefined) ?? '',
    KEYBASE_CRASH_REPORT: (env['KEYBASE_CRASH_REPORT'] as string | undefined) ?? '',
    KEYBASE_DEVEL_USE_XDG: (env['KEYBASE_DEVEL_USE_XDG'] as string | undefined) ?? '',
    KEYBASE_RESTORE_UI: (env['KEYBASE_RESTORE_UI'] as string | undefined) ?? '',
    KEYBASE_RUN_MODE: (env['KEYBASE_RUN_MODE'] as string | undefined) || 'prod',
    KEYBASE_START_UI: (env['KEYBASE_START_UI'] as string | undefined) ?? '',
    KEYBASE_XDG_OVERRIDE: (env['KEYBASE_XDG_OVERRIDE'] as string | undefined) ?? '',
    LANG: (env['LANG'] as string | undefined) ?? '',
    LC_ALL: (env['LC_ALL'] as string | undefined) ?? '',
    LC_TIME: (env['LC_TIME'] as string | undefined) ?? '',
    LOCALAPPDATA: (env['LOCALAPPDATA'] as string | undefined) ?? '',
    XDG_CACHE_HOME: (env['XDG_CACHE_HOME'] as string | undefined) ?? '',
    XDG_CONFIG_HOME: (env['XDG_CONFIG_HOME'] as string | undefined) ?? '',
    XDG_DATA_HOME: (env['XDG_DATA_HOME'] as string | undefined) ?? '',
    XDG_DOWNLOAD_DIR: (env['XDG_DOWNLOAD_DIR'] as string | undefined) ?? '',
    XDG_RUNTIME_DIR: (env['XDG_RUNTIME_DIR'] as string | undefined) ?? '',
  },
  helloDetails: {
    argv,
    clientType: 2, // RPCTypes.ClientType.guiMain,
    desc: 'Main Renderer',
    pid,
    version: __VERSION__,
  },
  isRenderer: process.type === 'renderer',
  localFileHost,
  pathSep,
  platform,
  startDarkMode: nativeTheme.shouldUseDarkColors,
  windowsBinPath: path.resolve((env['LOCALAPPDATA'] as string | undefined) ?? '', 'Keybase', 'keybase.exe'),
}

// every window's preload refuses constants without it, so fail here once instead of blanking each window
if (!kb2.assetRoot) {
  throw new Error('Invalid kb2: no assetRoot')
}

export default kb2
