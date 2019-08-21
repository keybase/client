type RunMode = string
type Env = {[key: string]: string | undefined}
type PathJoin = (...s: Array<string>) => string

const socketName = 'keybased.sock'

const getLinuxPaths = (runMode: RunMode, env: Env, pathJoin: PathJoin) => {
  const homeEnv = env['HOME'] || ''
  const useXDG = (runMode !== 'devel' || env['KEYBASE_DEVEL_USE_XDG']) && !env['KEYBASE_XDG_OVERRIDE']

  // If XDG_RUNTIME_DIR is defined use that, else use $HOME/.config.
  const homeConfigDir = (useXDG && env['XDG_CONFIG_HOME']) || pathJoin(homeEnv, '.config')
  const runtimeDir = (useXDG && env['XDG_RUNTIME_DIR']) || ''
  const socketDir = (useXDG && runtimeDir) || homeConfigDir

  const appName = `keybase${runMode === 'prod' ? '' : `.${runMode}`}`

  if (!runtimeDir && !homeEnv) {
    console.warn(
      "You don't have $HOME or $XDG_RUNTIME_DIR defined, so we can't find the Keybase service path."
    )
  }

  const logDir = `${(useXDG && env['XDG_CACHE_HOME']) || `${homeEnv}/.cache`}/${appName}/`

  return {
    cacheRoot: logDir,
    dataRoot: `${(useXDG && env['XDG_DATA_HOME']) || `${homeEnv}/.local/share`}/${appName}/`,
    jsonDebugFileName: `${logDir}keybase.app.debug`,
    logDir,
    logFileName: `${logDir}Keybase.app.log`,
    serverConfigFileName: `${logDir}keybase.app.serverConfig`,
    socketPath: pathJoin(socketDir, appName, socketName),
  }
}

const getWindowsPaths = (runMode: RunMode, env: Env, pathJoin: PathJoin) => {
  const appName = `Keybase${runMode === 'prod' ? '' : runMode[0].toUpperCase() + runMode.slice(1)}`
  let appdata = env['LOCALAPPDATA'] || ''
  // Remove leading drive letter e.g. C:
  if (/^[a-zA-Z]:/.test(appdata)) {
    appdata = appdata.slice(2)
  }
  let dir = `\\\\.\\pipe\\kbservice${appdata}\\${appName}`
  const logDir = `${env['LOCALAPPDATA'] || ''}\\${appName}\\`
  return {
    cacheRoot: `${env['APPDATA'] || ''}\\${appName}\\`,
    dataRoot: `${env['LOCALAPPDATA'] || ''}\\${appName}\\`,
    jsonDebugFileName: `${logDir}keybase.app.debug`,
    logDir,
    logFileName: `${logDir}keybase.app.log`,
    serverConfigFileName: `${logDir}keybase.app.serverConfig`,
    socketPath: pathJoin(dir, socketName),
  }
}

const getDarwinPaths = (runMode: RunMode, env: Env, pathJoin: PathJoin) => {
  const homeEnv = env['HOME'] || ''
  const appName = `Keybase${runMode === 'prod' ? '' : runMode[0].toUpperCase() + runMode.slice(1)}`
  const libraryDir = `${homeEnv}/Library/`
  const logDir = `${libraryDir}Logs/`

  return {
    cacheRoot: `${libraryDir}Caches/${appName}/`,
    dataRoot: `${libraryDir}Application Support/${appName}/`,
    jsonDebugFileName: `${logDir}${appName}.app.debug`,
    logDir,
    logFileName: `${logDir}${appName}.app.log`,
    serverConfigFileName: `${logDir}${appName}.app.serverConfig`,
    socketPath: pathJoin(`${libraryDir}Group Containers/keybase/Library/Caches/${appName}/`, socketName),
  }
}

export default (platform: string, runMode: RunMode, env: Env, pathJoin: PathJoin) => {
  switch (platform) {
    case 'darwin':
      return getDarwinPaths(runMode, env, pathJoin)
    case 'win32':
      return getWindowsPaths(runMode, env, pathJoin)
    case 'linux':
      return getLinuxPaths(runMode, env, pathJoin)
    default:
      throw new Error('Unknown OS')
  }
}
