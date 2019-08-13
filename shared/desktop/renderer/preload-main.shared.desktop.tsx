import path from 'path'
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

const runMode = process.env['KEYBASE_RUN_MODE'] || 'prod'
const paths = platformPaths(process.platform, runMode, process.env, path.join)

const target = typeof window === 'undefined' ? global : window

target.KB = {
  electron: {
    systemPreferences: {
      isDarkMode: () => systemPreferences.isDarkMode(),
    },
  },
  fs: {
    readJsonDebug: () => safeReadJSONFile(paths.jsonDebugFileName),
    readServerConfig: () => safeReadJSONFile(paths.serverConfigFileName),
  },
  path: {
    join: path.join,
  },
  process: {
    env: process.env,
    platform: process.platform,
  },
}
