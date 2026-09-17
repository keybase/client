import logger from '@/logger'
import isEqual from 'lodash/isEqual'
import {ignorePromise, timeoutPromise} from '@/constants/utils'
import * as T from '@/constants/types'
import * as Z from '@/util/zustand'
import {maxHandshakeTries} from '@/constants/values'
import {useConfigState} from '@/stores/config'

// A bootstrap step gates the handshake: the app stays on the splash screen until every step
// resolves. Throwing fails the whole attempt (FatalHandshakeError skips the remaining retries).
// Steps are injected by initSharedSubscriptions since stores can't import the init layer.
export type BootstrapStep = () => Promise<void>

export class FatalHandshakeError extends Error {}

type Store = T.Immutable<{
  // without the version: that only orders this read against the login, logout and http server
  // notifications, and keeping it would make every read after one of those look like a change
  bootstrapStatus?: Omit<T.RPCGen.BootstrapStatus, 'version'>
  error?: Error
  handshakeFailedReason: string
  /** counts handshakes, so consumers can tell one reconnect from the next */
  handshakeGeneration: number
  handshakeRetriesLeft: number
  handshakeState: T.Config.DaemonHandshakeState
}>

const initialStore: Store = {
  bootstrapStatus: undefined,
  error: undefined,
  handshakeFailedReason: '',
  handshakeGeneration: 0,
  handshakeRetriesLeft: maxHandshakeTries,
  handshakeState: 'loading',
}

export type State = Store & {
  dispatch: {
    initBootstrapSteps: (steps: Array<BootstrapStep>) => void
    loadDaemonBootstrapStatus: () => Promise<void>
    resetState: () => void
    setError: (e?: Error) => void
    startHandshake: () => void
    updateUserReacjis: (userReacjis: T.RPCGen.UserReacjis) => void
  }
}

const retryDelayMs = 1000
// the initial read plus two retries; a status that keeps losing to newer logins or logouts is dropped
const maxStaleSnapshotReads = 3

export const useDaemonState = Z.createZustand<State>('daemon', (set, get) => {
  let bootstrapSteps: Array<BootstrapStep> = []
  // bumped on every startHandshake (engine reconnect, splash Reload) so a stale in-flight
  // run can't write results over a newer one
  let generation = 0
  let inflightBootstrapStatus: Promise<void> | undefined

  const dispatch: State['dispatch'] = {
    initBootstrapSteps: steps => {
      bootstrapSteps = steps
    },
    loadDaemonBootstrapStatus: async () => {
      if (inflightBootstrapStatus) {
        return inflightBootstrapStatus
      }
      const gen = generation
      const f = async () => {
        const configDispatch = useConfigState.getState().dispatch
        for (let read = 1; read <= maxStaleSnapshotReads; read++) {
          const {version, ...bs} = await T.RPCGen.configGetBootstrapStatusRpcPromise()
          logger.info(
            `[Bootstrap] loggedIn: ${bs.loggedIn ? 1 : 0} http: ${bs.httpSrvInfo ? bs.httpSrvInfo.address : 'none'} version: ${version}`
          )
          // applied here rather than from bootstrapStatus: the address has its own ordering, and a
          // status that is skipped below or later edited in place must not skip or replay it
          if (bs.httpSrvInfo) {
            configDispatch.setHTTPSrvInfo(bs.httpSrvInfo.address, bs.httpSrvInfo.token, version)
          }
          if (!configDispatch.acceptSessionSnapshot(version)) {
            logger.info('[Bootstrap] a login or logout is newer than this status, reading it again')
            continue
          }
          // a newer handshake owns the store now; don't write a potentially older status over its load
          if (gen !== generation || isEqual(bs, get().bootstrapStatus)) {
            return
          }
          set(s => {
            s.bootstrapStatus = T.castDraft(bs)
          })
          return
        }
        logger.warn('[Bootstrap] the status kept losing to newer logins or logouts, not applying it')
      }
      const p = f()
      inflightBootstrapStatus = p
      try {
        await p
      } finally {
        if (inflightBootstrapStatus === p) {
          inflightBootstrapStatus = undefined
        }
      }
    },
    resetState: () => {
      set(s => ({
        ...s,
        ...initialStore,
        dispatch: s.dispatch,
        handshakeState: s.handshakeState,
      }))
    },
    setError: e => {
      if (e) {
        logger.error('Error (daemon):', e)
      }
      set(s => {
        s.error = e
      })
    },
    startHandshake: () => {
      const gen = ++generation
      // startHandshake follows an engine reset, which drops in-flight RPCs without settling
      // their promises; reusing one here would stall the handshake forever
      inflightBootstrapStatus = undefined
      set(s => {
        s.error = undefined
        s.handshakeFailedReason = ''
        s.handshakeGeneration = gen
        s.handshakeRetriesLeft = maxHandshakeTries
        s.handshakeState = 'loading'
      })
      const run = async () => {
        while (gen === generation) {
          try {
            await get().dispatch.loadDaemonBootstrapStatus()
            await Promise.all(bootstrapSteps.map(async step => step()))
            if (gen !== generation) {
              return
            }
            set(s => {
              s.handshakeFailedReason = ''
              s.handshakeState = 'done'
            })
            logger.info('[Bootstrap] handshake done')
            return
          } catch (error) {
            if (gen !== generation) {
              return
            }
            const fatal = error instanceof FatalHandshakeError
            logger.warn('[Bootstrap] handshake attempt failed:', error)
            set(s => {
              s.handshakeFailedReason = error instanceof Error ? error.message : String(error)
              s.handshakeRetriesLeft = fatal ? 0 : Math.max(0, s.handshakeRetriesLeft - 1)
            })
            if (get().handshakeRetriesLeft === 0) {
              set(s => {
                s.handshakeState = 'failed'
              })
              return
            }
            await timeoutPromise(retryDelayMs)
          }
        }
      }
      ignorePromise(run())
    },
    updateUserReacjis: userReacjis => {
      set(s => {
        if (s.bootstrapStatus) {
          s.bootstrapStatus.userReacjis = T.castDraft(userReacjis)
        }
      })
    },
  }
  return {
    ...initialStore,
    dispatch,
  }
})
