import logger from '../logger'
import * as ConfigGen from '../actions/config-gen'
import type * as Types from './types/config'
import * as Z from '../util/zustand'

export const maxHandshakeTries = 3

export type Store = {
  error?: Error
  handshakeState: Types.DaemonHandshakeState
  handshakeFailedReason: string
  handshakeRetriesLeft: number
  handshakeWaiters: Map<string, number>
  // if we ever restart handshake up this so we can ignore any waiters for old things
  handshakeVersion: number
}

const initialStore: Store = {
  handshakeFailedReason: '',
  handshakeRetriesLeft: maxHandshakeTries,
  handshakeState: 'starting',
  handshakeVersion: 1,
  handshakeWaiters: new Map(),
}

type State = Store & {
  dispatch: {
    resetState: () => void
    setError: (e?: Error) => void
    setState: (s: Types.DaemonHandshakeState) => void
    wait: (
      name: string,
      version: number,
      increment: boolean,
      failedReason?: string,
      failedFatal?: true
    ) => void
    startHandshake: () => void
    daemonHandshake: (firstTimeConnecting: boolean, version: number) => void
    daemonHandshakeDone: () => void
  }
}

export const useDaemonState = Z.createZustand<State>((set, get) => {
  const reduxDispatch = Z.getReduxDispatch()

  const setFailed = (r: string) => {
    set(s => {
      s.handshakeFailedReason = r
    })
  }
  const setState = (ds: Types.DaemonHandshakeState) => {
    set(s => {
      s.handshakeState = ds
    })
  }
  const daemonHandshake = (firstTimeConnecting: boolean, version: number) => {
    setState('waitingForWaiters')
    set(s => {
      s.handshakeVersion = version
      s.handshakeWaiters = new Map()
    })
    reduxDispatch(ConfigGen.createDaemonHandshake({firstTimeConnecting, version}))
  }
  const setError = (e?: Error) => {
    if (e) {
      logger.error('Error (daemon):', e)
    }
    set(s => {
      s.error = e
    })
  }
  const daemonHandshakeDone = () => {
    setState('done')
    reduxDispatch(ConfigGen.createDaemonHandshakeDone())
  }

  const restartHandshake = () => {
    reduxDispatch(ConfigGen.createRestartHandshake())
    setState('starting')
    setFailed('')
    set(s => {
      s.handshakeRetriesLeft = maxHandshakeTries
    })
  }

  let _firstTimeBootstrapDone = true
  const maybeDoneWithDaemonHandshake = (version: number) => {
    if (version !== get().handshakeVersion) {
      // ignore out of date actions
      return
    }
    const {handshakeWaiters, handshakeFailedReason, handshakeRetriesLeft} = get()
    if (handshakeWaiters.size > 0) {
      // still waiting for things to finish
    } else {
      if (handshakeFailedReason) {
        if (handshakeRetriesLeft) {
          restartHandshake()
        }
      } else {
        if (_firstTimeBootstrapDone) {
          _firstTimeBootstrapDone = false
          logger.info('First bootstrap ended')
        }
        daemonHandshakeDone()
      }
    }
    return
  }

  // When there are no more waiters, we can show the actual app

  let _firstTimeConnecting = true
  const dispatch: State['dispatch'] = {
    daemonHandshake,
    daemonHandshakeDone,
    resetState: () => {
      set(s => ({
        ...s,
        ...initialStore,
        handshakeState: s.handshakeState,
        handshakeVersion: s.handshakeVersion,
      }))
    },
    setError,
    setState,
    startHandshake: () => {
      setError()
      setState('starting')
      setFailed('')
      set(s => {
        s.handshakeRetriesLeft = Math.max(0, s.handshakeRetriesLeft - 1)
      })

      const firstTimeConnecting = _firstTimeConnecting
      _firstTimeConnecting = false
      if (firstTimeConnecting) {
        logger.info('First bootstrap started')
      }

      daemonHandshake(firstTimeConnecting, get().handshakeVersion + 1)
    },
    wait: (name, version, increment, failedReason, failedFatal) => {
      const {handshakeState, handshakeFailedReason, handshakeVersion} = get()
      if (handshakeState !== 'waitingForWaiters') {
        throw new Error("Should only get a wait while we're waiting")
      }

      if (version !== handshakeVersion) {
        logger.info('Ignoring handshake wait due to version mismatch', version, handshakeVersion)
        return
      }

      set(s => {
        const oldCount = s.handshakeWaiters.get(name) || 0
        const newCount = oldCount + (increment ? 1 : -1)
        if (newCount === 0) {
          s.handshakeWaiters.delete(name)
        } else {
          s.handshakeWaiters.set(name, newCount)
        }
      })

      if (failedFatal) {
        setFailed(failedReason || '')
        set(s => {
          s.handshakeRetriesLeft = 0
        })
      } else {
        // Keep the first error
        const f = failedReason || ''
        if (f && !handshakeFailedReason) {
          setFailed(f)
        }
      }

      maybeDoneWithDaemonHandshake(version)
    },
  }
  return {
    ...initialStore,
    dispatch,
  }
})
