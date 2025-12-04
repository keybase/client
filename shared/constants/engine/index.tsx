import * as Z from '@/util/zustand'
import * as C from '..'
import type * as EngineGen from '@/actions/engine-gen-gen'
import {useState as useArchiveState} from '../archive'
import {useState as useAutoResetState} from '../autoreset'
import {useState as useDevicesState} from '../devices'
import {useState as useUFState} from '../unlock-folders'
import * as ChatUtil from '../chat2/util'
import * as NotifUtil from '../notifications/util'
import * as PeopleUtil from '../people/util'
import * as PinentryUtil from '../pinentry/util'
import * as TrackerUtil from '../tracker2/util'
import * as UnlockFoldersUtil from '../unlock-folders/util'

type Store = object
const initialStore: Store = {}

interface State extends Store {
  dispatch: {
    onEngineConnected: () => void
    onEngineDisconnected: () => void
    onEngineIncoming: (action: EngineGen.Actions) => void
    resetState: () => void
  }
}

export const useState_ = Z.createZustand<State>(set => {
  let incomingTimeout: NodeJS.Timeout
  const dispatch: State['dispatch'] = {
    onEngineConnected: () => {
      ChatUtil.onEngineConnected()
      C.useConfigState.getState().dispatch.onEngineConnected()
      NotifUtil.onEngineConnected()
      PeopleUtil.onEngineConnected()
      PinentryUtil.onEngineConnected()
      TrackerUtil.onEngineConnected()
      UnlockFoldersUtil.onEngineConnected()
    },
    onEngineDisconnected: () => {
      C.useConfigState.getState().dispatch.onEngineDisonnected()
    },
    onEngineIncoming: action => {
      // defer a frame so its more like before
      incomingTimeout = setTimeout(() => {
        useAutoResetState.getState().dispatch.onEngineIncoming(action)
        C.useBotsState.getState().dispatch.onEngineIncoming(action)
        C.useChatState.getState().dispatch.onEngineIncoming(action)
        C.useConfigState.getState().dispatch.dynamic.onEngineIncomingDesktop?.(action)
        C.useConfigState.getState().dispatch.dynamic.onEngineIncomingNative?.(action)
        C.useConfigState.getState().dispatch.onEngineIncoming(action)
        C.useDeepLinksState.getState().dispatch.onEngineIncoming(action)
        useDevicesState.getState().dispatch.onEngineIncoming(action)
        C.useFSState.getState().dispatch.onEngineIncoming(action)
        useArchiveState.getState().dispatch.onEngineIncoming(action)
        C.useGitState.getState().dispatch.onEngineIncoming(action)
        C.useNotifState.getState().dispatch.onEngineIncoming(action)
        C.usePeopleState.getState().dispatch.onEngineIncoming(action)
        C.usePinentryState.getState().dispatch.onEngineIncoming(action)
        C.useSettingsState.getState().dispatch.onEngineIncoming(action)
        C.useSignupState.getState().dispatch.onEngineIncoming(action)
        C.useTeamsState.getState().dispatch.onEngineIncoming(action)
        C.useTrackerState.getState().dispatch.onEngineIncoming(action)
        useUFState.getState().dispatch.onEngineIncoming(action)
        C.useUsersState.getState().dispatch.onEngineIncoming(action)
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
