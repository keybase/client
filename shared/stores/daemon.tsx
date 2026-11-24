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
    initBootstrapSteps: (steps: Array<BootstrapStep>, subscribe?: BootstrapStep) => void
    loadDaemonBootstrapStatus: () => Promise<void>
    onSessionChanged: (status: T.RPCGen.BootstrapStatus) => void
    refreshSessionFromDaemon: (reason: string) => void
    // refreshSessionFromDaemon for a caller that waits: settles once the read has applied, or failed
    readSessionFromDaemon: (reason: string) => Promise<void>
    resetState: () => void
    setError: (e?: Error) => void
    startHandshake: () => void
    updateUserReacjis: (userReacjis: T.RPCGen.UserReacjis) => void
  }
}

const retryDelayMs = 1000

export const useDaemonState = Z.createZustand<State>('daemon', (set, get) => {
  let bootstrapSteps: Array<BootstrapStep> = []
  // Runs before anything is read: a change between a read and the subscription would never reach us
  let subscribeStep: BootstrapStep | undefined
  // bumped on every startHandshake (engine reconnect, splash Reload) so a stale in-flight
  // run can't write results over a newer one
  let generation = 0
  // The service numbers its sessionChanged pushes per process. A read carries the number of the
  // latest push it is at least as new as, so it may replace that push; a push replaces only older
  // ones. Counted per connection: a new handshake may be talking to a restarted service.
  let sessionSeq = -1
  // Reads are numbered as they are issued. Two reads can carry the same seq and reply in either
  // order, so at an equal seq only a read issued after the one that applied may replace it.
  let readsIssued = 0
  let readAppliedAtSeq = 0
  // Until this connection's first read replies, a push may still be one the previous connection
  // sent (a restarted service numbers from zero again), so it is held back. The highest seq held
  // back is read again if the first read is older than it.
  let firstReadDone = false
  let heldPushSeq = -1

  // read is the read's issue number, undefined for a push
  const applySession = (bs: T.RPCGen.BootstrapStatus, read?: number) => {
    const stale =
      read === undefined
        ? bs.sessionSeq <= sessionSeq
        : bs.sessionSeq < sessionSeq || (bs.sessionSeq === sessionSeq && read < readAppliedAtSeq)
    if (stale) {
      return
    }
    readAppliedAtSeq = read ?? 0
    sessionSeq = bs.sessionSeq
    if (isEqual(bs, get().bootstrapStatus)) {
      return
    }
    set(s => {
      s.bootstrapStatus = T.castDraft(bs)
    })
  }

  const readBootstrapStatus = async () => {
    const gen = generation
    const read = ++readsIssued
    const bs = await T.RPCGen.configGetBootstrapStatusRpcPromise()
    logger.info(
      `[Bootstrap] loggedIn: ${bs.loggedIn ? 1 : 0} seq: ${bs.sessionSeq} http: ${bs.httpSrvInfo ? bs.httpSrvInfo.address : 'none'}`
    )
    // a newer handshake owns the store now
    if (gen !== generation) {
      return
    }
    applySession(bs, read)
    if (!firstReadDone) {
      firstReadDone = true
      if (heldPushSeq > bs.sessionSeq) {
        get().dispatch.refreshSessionFromDaemon('a session sent before the first read replied')
      }
    }
  }

  const dispatch: State['dispatch'] = {
    initBootstrapSteps: (steps, subscribe) => {
      bootstrapSteps = steps
      subscribeStep = subscribe
    },
    loadDaemonBootstrapStatus: readBootstrapStatus,
    onSessionChanged: status => {
      logger.info(`[Bootstrap] session changed: loggedIn: ${status.loggedIn ? 1 : 0} seq: ${status.sessionSeq}`)
      if (!firstReadDone) {
        heldPushSeq = Math.max(heldPushSeq, status.sessionSeq)
        return
      }
      applySession(status)
    },
    readSessionFromDaemon: async reason => {
      logger.info(`[Bootstrap] reading the session: ${reason}`)
      try {
        await readBootstrapStatus()
      } catch (error) {
        logger.warn('[Bootstrap] reading the session failed:', error)
      }
    },
    refreshSessionFromDaemon: reason => {
      ignorePromise(get().dispatch.readSessionFromDaemon(reason))
    },
    resetState: () => {
      set(s => ({
        ...s,
        ...initialStore,
        // The service's session, not the account's: it stays what the service last said, so an
        // account switch that ends with no session change can apply it again.
        bootstrapStatus: s.bootstrapStatus,
        dispatch: s.dispatch,
        // Both track the connection, not the account, and the closure counter behind the
        // generation keeps climbing across a reset: zeroing the copy here would make the live
        // connection's own in-flight work look superseded by a logout that happened under it.
        handshakeGeneration: s.handshakeGeneration,
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
      sessionSeq = -1
      readAppliedAtSeq = 0
      firstReadDone = false
      heldPushSeq = -1
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
            await subscribeStep?.()
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
