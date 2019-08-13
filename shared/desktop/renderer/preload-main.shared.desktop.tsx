import path from 'path'
import os from 'os'
import fs from 'fs'
import platformPaths from '../../constants/platform-paths.desktop'
import Electron from 'electron'

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

const runMode = process.env['KEYBASE_RUN_MODE'] || 'prod'
const paths = platformPaths(process.platform, runMode, process.env, path.join)

const target = typeof window === 'undefined' ? global : window

target.KB = {
  __dirname: __dirname,
  electron: {
    app: {
      getAppPath: () => app.getAppPath(),
    },
    shell: {
      openExternal: (url: string): Promise<void> => shell.openExternal(url),
    },
    systemPreferences: {
      isDarkMode: () => systemPreferences.isDarkMode(),
    },
  },
  fs: {
    isDirectory: (path: string) => fs.lstatSync(path).isDirectory(),
    readJsonDebug: () => safeReadJSONFile(paths.jsonDebugFileName),
    readServerConfig: () => safeReadJSONFile(paths.serverConfigFileName),
  },
  os: {
    homedir: () => os.homedir(),
  },
  path: {
    basename: path.basename,
    dirname: path.dirname,
    isAbsolute: path.isAbsolute,
    join: path.join,
    resolve: path.resolve,
    sep: path.sep,
  },
  process: {
    env: process.env,
    platform: process.platform,
  },
}
