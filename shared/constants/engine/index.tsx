import type * as EngineGen from '@/actions/engine-gen-gen'
import * as Z from '@/util/zustand'
import * as ChatUtil from '../chat2/util'
import * as NotifUtil from '../notifications/util'
import * as PeopleUtil from '../people/util'
import * as PinentryUtil from '../pinentry/util'
import {onEngineIncoming as onEngineIncomingShared} from '../platform-specific/shared'
import {storeRegistry} from '../store-registry'
import * as TrackerUtil from '../tracker2/util'
import * as UnlockFoldersUtil from '../unlock-folders/util'

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
      storeRegistry.getState('config').dispatch.onEngineConnected()
      NotifUtil.onEngineConnected()
      PeopleUtil.onEngineConnected()
      PinentryUtil.onEngineConnected()
      TrackerUtil.onEngineConnected()
      UnlockFoldersUtil.onEngineConnected()
    },
    onEngineDisconnected: () => {
      storeRegistry.getState('config').dispatch.onEngineDisonnected()
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
