// There are capabilities we need from the node process that need to be plumbed through. In order to simplify our code internally
// instead of having a lot of async logic getting some static values we instead wait to load these values on start before we
// start drawing. If you need access to these values you need to call `waitOnKB2Loaded`
// the electron preload scripts will create kb2 on the node side and plumb it back and then call `injectPreload`
type KB2 = {
  assetRoot: string
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

const theKB2 = {
  get assetRoot() {
    return getStashed().assetRoot
  },
}

export default theKB2
