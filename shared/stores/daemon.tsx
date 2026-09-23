import logger from '@/logger'
import isEqual from 'lodash/isEqual'
import {ignorePromise, timeoutPromise} from '@/constants/utils'
import * as T from '@/constants/types'
import * as Z from '@/util/zustand'
import {maxHandshakeTries} from '@/constants/values'

// A bootstrap step gates the handshake: the app stays on the splash screen until every step
// resolves. Throwing fails the whole attempt (FatalHandshakeError skips the remaining retries).
// Steps are injected by initSharedSubscriptions since stores can't import the init layer.
export type BootstrapStep = () => Promise<void>

export class FatalHandshakeError extends Error {}

type Store = T.Immutable<{
  bootstrapStatus?: T.RPCGen.BootstrapStatus
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
    /** reads the session afresh, superseding any read in flight; for hints that it changed */
    refreshSessionFromDaemon: (reason: string) => void
    resetState: () => void
    setBootstrapStatus: (bs: T.RPCGen.BootstrapStatus) => void
    setError: (e?: Error) => void
    startHandshake: () => void
    updateUserReacjis: (userReacjis: T.RPCGen.UserReacjis) => void
  }
}

const retryDelayMs = 1000

export const useDaemonState = Z.createZustand<State>('daemon', (set, get) => {
  let bootstrapSteps: Array<BootstrapStep> = []
  // bumped on every startHandshake (engine reconnect, splash Reload) so a stale in-flight
  // run can't write results over a newer one
  let generation = 0
  // The latest read in flight. Only the latest read's reply is applied: a read asked for later
  // reflects every session change the service had made by then.
  let inflightBootstrapStatus: Promise<void> | undefined
  let readSeq = 0

  const readBootstrapStatus = async () => {
    const gen = generation
    const seq = ++readSeq
    const f = async (): Promise<void> => {
      const bs = await T.RPCGen.configGetBootstrapStatusRpcPromise()
      logger.info(
        `[Bootstrap] loggedIn: ${bs.loggedIn ? 1 : 0} http: ${bs.httpSrvInfo ? bs.httpSrvInfo.address : 'none'}`
      )
      // a newer handshake owns the store now; don't write a potentially older status over its load
      if (gen !== generation) {
        return
      }
      if (seq !== readSeq) {
        // superseded: settle with the newer read, so a caller awaiting this one sees its status
        return inflightBootstrapStatus
      }
      if (isEqual(bs, get().bootstrapStatus)) {
        return
      }
      set(s => {
        s.bootstrapStatus = T.castDraft(bs)
      })
    }
    const p = f().finally(() => {
      if (inflightBootstrapStatus === p) {
        inflightBootstrapStatus = undefined
      }
    })
    inflightBootstrapStatus = p
    return p
  }

  const dispatch: State['dispatch'] = {
    initBootstrapSteps: steps => {
      bootstrapSteps = steps
    },
    loadDaemonBootstrapStatus: async () => inflightBootstrapStatus ?? readBootstrapStatus(),
    refreshSessionFromDaemon: reason => {
      logger.info(`[Bootstrap] reading the session: ${reason}`)
      readBootstrapStatus().catch((error: unknown) => {
        logger.warn('[Bootstrap] reading the session failed:', error)
      })
    },
    resetState: () => {
      set(s => ({
        ...s,
        ...initialStore,
        dispatch: s.dispatch,
        // Both track the connection, not the account, and the closure counter behind the
        // generation keeps climbing across a reset: zeroing the copy here would make the live
        // connection's own in-flight work look superseded by a logout that happened under it.
        handshakeGeneration: s.handshakeGeneration,
        handshakeState: s.handshakeState,
      }))
    },
    setBootstrapStatus: bs => {
      set(s => {
        s.bootstrapStatus = T.castDraft(bs)
      })
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
