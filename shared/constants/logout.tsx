import {useRouterState} from '.'
import logger from '../logger'
import * as RPCTypes from '../constants/types/rpc-gen'
// normally util.container but it re-exports from us so break the cycle
import * as Z from '../util/zustand'

const ignorePromise = (f: Promise<void>) => {
  f.then(() => {}).catch(() => {})
}

export type Store = {
  waiters: Map<string, number>
  // if we ever restart handshake up this so we can ignore any waiters for old things
  version: number
}

const initialStore: Store = {
  version: 1,
  waiters: new Map(),
}

type State = Store & {
  dispatch: {
    resetState: () => void
    wait: (name: string, version: number, increment: boolean) => void
    start: () => void
    requestLogout: () => void
  }
}

export const useState = Z.createZustand<State>((set, get) => {
  const dispatch: State['dispatch'] = {
    requestLogout: () => {
      // Figure out whether we can log out using CanLogout, if so,
      // startLogoutHandshake, else do what's needed - right now only
      // redirect to set password screen.
      const f = async () => {
        const canLogoutRes = await RPCTypes.userCanLogoutRpcPromise()
        if (canLogoutRes.canLogout) {
          get().dispatch.start()
          return
        } else {
          const {passwordTab} = await import('./settings')
          const {settingsTab} = await import('./tabs')
          const {isMobile} = await import('./platform')
          if (isMobile) {
            useRouterState.getState().dispatch.navigateAppend(passwordTab)
          } else {
            useRouterState.getState().dispatch.navigateAppend(settingsTab)
            useRouterState.getState().dispatch.navigateAppend(passwordTab)
          }
        }
      }
      ignorePromise(f())
    },
    resetState: () => {
      set(s => ({
        ...s,
        ...initialStore,
        version: s.version,
        waiters: s.waiters,
      }))
    },
    start: () => {
      const version = get().version + 1
      set(s => {
        s.version = version
      })

      // Give time for all waiters to register and allow the case where there are no waiters
      const f = async () => {
        const waitKey = 'nullhandshake'
        get().dispatch.wait(waitKey, version, true)
        await Z.timeoutPromise(10)
        get().dispatch.wait(waitKey, version, false)
      }
      Z.ignorePromise(f())
    },
    wait: (name, _version, increment) => {
      const {version} = get()

      if (version !== _version) {
        logger.info('Ignoring handshake wait due to version mismatch', version, _version)
        return
      }

      set(s => {
        const oldCount = s.waiters.get(name) || 0
        const newCount = oldCount + (increment ? 1 : -1)
        if (newCount === 0) {
          s.waiters.delete(name)
        } else {
          s.waiters.set(name, newCount)
        }
      })

      const {waiters} = get()
      if (waiters.size > 0) {
        // still waiting for things to finish
      } else {
        RPCTypes.loginLogoutRpcPromise({force: false, keepSecrets: false})
          .then(() => {})
          .catch(() => {})
      }
    },
  }
  return {
    ...initialStore,
    dispatch,
  }
})
