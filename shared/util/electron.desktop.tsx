// There are capabilities we need from the node process that need to be plumbed through. In order to simplify our code internally
// instead of having a lot of async logic getting some static values we instead wait to load these values on start before we
// start drawing. If you need access to these values you need to call `waitOnKB2Loaded`
// the electron preload scripts will create kb2 on the node side and plumb it back and then call `injectPreload`
type KB2 = {
  assetRoot: string
  dokanPath: string
  env: {
    APPDATA: string
    HOME: string
    KEYBASE_AUTOSTART: string
    KEYBASE_CRASH_REPORT: string
    KEYBASE_DEVEL_USE_XDG: string
    KEYBASE_RESTORE_UI: string
    KEYBASE_RUN_MODE: string
    KEYBASE_START_UI: string
    KEYBASE_XDG_OVERRIDE: string
    LANG: string
    LC_ALL: string
    LC_TIME: string
    LOCALAPPDATA: string
    XDG_CACHE_HOME: string
    XDG_CONFIG_HOME: string
    XDG_DATA_HOME: string
    XDG_DOWNLOAD_DIR: string
    XDG_RUNTIME_DIR: string
  }
  windowsBinPath: string
}

const kb2Waiters = new Array<() => void>()

export const injectPreload = (kb2: KB2) => {
  if (!kb2 || !kb2.assetRoot) {
    throw new Error('Invalid kb2 injected')
  }
  // we have to stash this in a global due to how preload works, else it clears out the module level variables
  globalThis._fromPreload = kb2
  while (kb2Waiters.length) {
    kb2Waiters.shift()?.()
  }
}

export const waitOnKB2Loaded = (cb: () => void) => {
  if (globalThis._fromPreload) {
    cb()
  } else {
    kb2Waiters.push(cb)
  }
}

const getStashed = () => {
  if (!globalThis._fromPreload) throw new Error('KB2 not injected!')
  return globalThis._fromPreload as KB2
}

const theKB2: KB2 = {
  get assetRoot() {
    return getStashed().assetRoot
  },
  get dokanPath() {
    return getStashed().dokanPath
  },
  get env() {
    return getStashed().env
  },
  get windowsBinPath() {
    return getStashed().windowsBinPath
  },
}

export default theKB2
