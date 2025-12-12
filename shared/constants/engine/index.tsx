import * as Z from '@/util/zustand'
import {storeRegistry} from '../store-registry'
import type * as EngineGen from '@/actions/engine-gen-gen'
import * as ArchiveUtil from '../archive/util'
import * as AutoResetUtil from '../autoreset/util'
import * as BotsUtil from '../bots/util'
import * as ChatUtil from '../chat2/util'
import * as DeepLinksUtil from '../deeplinks/util'
import * as DevicesUtil from '../devices/util'
import * as FSUtil from '../fs/util'
import * as GitUtil from '../git/util'
import * as NotifUtil from '../notifications/util'
import * as PeopleUtil from '../people/util'
import * as PinentryUtil from '../pinentry/util'
import * as SettingsUtil from '../settings/util'
import * as SignupUtil from '../signup/util'
import * as TeamsUtil from '../teams/util'
import * as TrackerUtil from '../tracker2/util'
import * as UnlockFoldersUtil from '../unlock-folders/util'
import * as UsersUtil from '../users/util'

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
        ArchiveUtil.onEngineIncoming(action)
        AutoResetUtil.onEngineIncoming(action)
        BotsUtil.onEngineIncoming(action)
        ChatUtil.onEngineIncoming(action)
        storeRegistry.getState('config').dispatch.dynamic.onEngineIncomingDesktop?.(action)
        storeRegistry.getState('config').dispatch.dynamic.onEngineIncomingNative?.(action)
        storeRegistry.getState('config').dispatch.onEngineIncoming(action)
        DeepLinksUtil.onEngineIncoming(action)
        DevicesUtil.onEngineIncoming(action)
        FSUtil.onEngineIncoming(action)
        GitUtil.onEngineIncoming(action)
        NotifUtil.onEngineIncoming(action)
        PeopleUtil.onEngineIncoming(action)
        PinentryUtil.onEngineIncoming(action)
        SettingsUtil.onEngineIncoming(action)
        SignupUtil.onEngineIncoming(action)
        TeamsUtil.onEngineIncoming(action)
        TrackerUtil.onEngineIncoming(action)
        UnlockFoldersUtil.onEngineIncoming(action)
        UsersUtil.onEngineIncoming(action)
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
