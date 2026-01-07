import type * as EngineGen from '@/actions/engine-gen-gen'
import * as Z from '@/util/zustand'
import * as ChatUtil from '../chat2/util'
import * as NotifUtil from '../notifications/util'
import * as PeopleUtil from '../people/util'
import * as PinentryUtil from '../pinentry/util'
import {onEngineIncoming as onEngineIncomingShared} from '../platform-specific/shared'
import {storeRegistry} from '../store-registry'
import {useConfigState} from '../config'
import {ignorePromise} from '../utils'
import * as TrackerUtil from '../tracker2/util'
import * as UnlockFoldersUtil from '../unlock-folders/util'
import logger from '@/logger'

type Store = object
const initialStore: Store = {}

export interface State extends Store {
  dispatch: {
    onEngineConnected: () => void
    onEngineDisconnected: () => void
    onEngineIncoming: (action: EngineGen.Actions) => void
    resetState: () => void
  }
}

export const useEngineState = Z.createZustand<State>(set => {
  let incomingTimeout: NodeJS.Timeout
  const dispatch: State['dispatch'] = {
    onEngineConnected: () => {
      ChatUtil.onEngineConnected()
      useConfigState.getState().dispatch.onEngineConnected()
      storeRegistry.getState('daemon').dispatch.startHandshake()
      NotifUtil.onEngineConnected()
      PeopleUtil.onEngineConnected()
      PinentryUtil.onEngineConnected()
      TrackerUtil.onEngineConnected()
      UnlockFoldersUtil.onEngineConnected()
    },
    onEngineDisconnected: () => {
      const f = async () => {
        await logger.dump()
      }
      ignorePromise(f())
      storeRegistry.getState('daemon').dispatch.setError(new Error('Disconnected'))
    },
    onEngineIncoming: action => {
      // defer a frame so its more like before
      incomingTimeout = setTimeout(() => {
        // we delegate to these utils so we don't need to load stores that we don't need yet
        onEngineIncomingShared(action)
      }, 0)
    },
    resetState: () => {
      set(s => ({...s, ...initialStore, dispatch: s.dispatch}))
      clearTimeout(incomingTimeout)
    },
  }
  return {
    ...initialStore,
    dispatch,
  }
})
