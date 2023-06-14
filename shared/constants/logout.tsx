import logger from '../logger'
import * as ConfigGen from '../actions/config-gen'
import * as RPCTypes from '../constants/types/rpc-gen'
// normally util.container but it re-exports from us so break the cycle
import {create as createZustand} from 'zustand'
import {immer as immerZustand} from 'zustand/middleware/immer'
import {getReduxDispatch} from '../util/zustand'

export const maxHandshakeTries = 3

export type ZStore = {
  waiters: Map<string, number>
  // if we ever restart handshake up this so we can ignore any waiters for old things
  version: number
}

const initialZState: ZStore = {
  version: 1,
  waiters: new Map(),
}

type ZState = ZStore & {
  dispatch: {
    reset: () => void
    wait: (name: string, version: number, increment: boolean) => void
    start: () => void
  }
}

export const useLogoutState = createZustand(
  immerZustand<ZState>((set, get) => {
    const reduxDispatch = getReduxDispatch()

    const maybeDoneWithDaemonHandshake = (version: number) => {
      if (version !== get().version) {
        // ignore out of date actions
        return
      }
      const {waiters} = get()
      if (waiters.size > 0) {
        // still waiting for things to finish
      } else {
        RPCTypes.loginLogoutRpcPromise({force: false, keepSecrets: false})
          .then(() => {})
          .catch(() => {})
      }
      return
    }

    const dispatch = {
      reset: () => {
        set(s => ({
          ...initialZState,
          version: s.version,
          waiters: s.waiters,
        }))
      },
      start: () => {
        const version = get().version + 1
        set(s => {
          s.version = version
        })
        reduxDispatch(ConfigGen.createLogoutHandshake({version}))
      },
      wait: (name: string, _version: number, increment: boolean) => {
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

        maybeDoneWithDaemonHandshake(version)
      },
    }
    return {
      ...initialZState,
      dispatch,
    }
  })
)
