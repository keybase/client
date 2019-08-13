import Electron from 'electron'
import crypto from 'crypto'
import fs from 'fs'
import os from 'os'
import path from 'path'
import platformPaths from '../../constants/platform-paths.desktop'
// eslint-disable-next-line
import punycode from 'punycode'

const _process = process

const safeReadJSONFile = (name: string) => {
  try {
    return (fs.existsSync(name) && JSON.parse(fs.readFileSync(name, 'utf8'))) || {}
  } catch (_) {}
  return {}
}

const isRenderer = typeof process !== 'undefined' && process.type === 'renderer'

const systemPreferences = isRenderer ? Electron.remote.systemPreferences : Electron.systemPreferences
const app = isRenderer ? Electron.remote.app : Electron.app
const shell = isRenderer ? Electron.remote.shell : Electron.shell
const ipcRenderer = isRenderer ? Electron.ipcRenderer : undefined
const ipcMain = isRenderer ? Electron.remote.ipcMain : Electron.ipcMain
const getCurrentWindow = isRenderer ? Electron.remote.getCurrentWindow : undefined

const runMode = process.env['KEYBASE_RUN_MODE'] || 'prod'
const paths = platformPaths(process.platform, runMode, process.env, path.join)

const target = typeof window === 'undefined' ? global : window

target.KB = {
  __dirname: __dirname,
  crypto: {
    randomBytes: (size: number, cb: (err: Error | null, buf: Buffer) => void) => crypto.randomBytes(size, cb),
  },
  electron: {
    app: {
      emitCloseWindows: () => app.emit('close-windows'),
      getAppPath: () => app.getAppPath(),
    },
    currentWindow: {
      hide: () => getCurrentWindow && getCurrentWindow().hide(),
    },
    ipcMain: {
      on: (name: string, cb: (...a: Array<any>) => void) => {
        ipcMain.on(name, cb)
      },
    },
    ipcRenderer: {
      sendExecuteActions: (actions: Array<'closePopups' | 'quitMainWindow' | 'quitApp'>) =>
        ipcRenderer && ipcRenderer.send('executeActions', actions),
    },
    shell: {
      openExternal: (url: string): Promise<void> => shell.openExternal(url),
    },
    systemPreferences: {
      isDarkMode: () => systemPreferences.isDarkMode(),
    },
  },
  fs: {
    __: fs,
    access: (path: string, mode: number | undefined, cb: (err: NodeJS.ErrnoException) => void) =>
      fs.access(path, mode, cb),
    constants: {
      F_OK: fs.constants.F_OK,
    },
    isDirectory: (path: string) => fs.lstatSync(path).isDirectory(),
    readJsonDebug: () => safeReadJSONFile(paths.jsonDebugFileName),
    readServerConfig: () => safeReadJSONFile(paths.serverConfigFileName),
    readdir: (path: string, cb: (err: NodeJS.ErrnoException, files: Array<string>) => void) =>
      fs.readdir(path, cb),
    realpath: (path: string, cb: (err: NodeJS.ErrnoException, resolvedPath: string) => void) =>
      fs.realpath(path, cb),
    stat: (path: string, cb: (err: NodeJS.ErrnoException, stats: fs.Stats) => void) => fs.stat(path, cb),
  },
  os: {
    homedir: () => os.homedir(),
  },
  path: {
    basename: path.basename,
    dirname: path.dirname,
    extname: path.extname,
    isAbsolute: path.isAbsolute,
    join: path.join,
    resolve: path.resolve,
    sep: path.sep,
  },
  process: {
    argv: _process.argv,
    env: _process.env,
    pid: _process.pid,
    platform: _process.platform,
  },
  punycode, // used by a dep
}
