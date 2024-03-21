import * as Z from '@/util/zustand'
import * as C from '.'
import type * as EngineGen from '../actions/engine-gen-gen'

type Store = {}
const initialStore: Store = {}

type State = Store & {
  dispatch: {
    onEngineConnected: () => void
    onEngineDisconnected: () => void
    onEngineIncoming: (action: EngineGen.Actions) => void
    resetState: () => void
  }
}

export const _useState = Z.createZustand<State>(set => {
  let incomingTimeout: NodeJS.Timeout
  const dispatch: State['dispatch'] = {
    onEngineConnected: () => {
      C.useChatState.getState().dispatch.onEngineConnected()
      C.useConfigState.getState().dispatch.onEngineConnected()
      C.useNotifState.getState().dispatch.onEngineConnected()
      C.usePeopleState.getState().dispatch.onEngineConnected()
      C.usePinentryState.getState().dispatch.onEngineConnected()
      C.useTrackerState.getState().dispatch.onEngineConnected()
      C.useUFState.getState().dispatch.onEngineConnected()
    },
    onEngineDisconnected: () => {
      C.useConfigState.getState().dispatch.onEngineDisonnected()
    },
    onEngineIncoming: action => {
      // defer a frame so its more like before
      incomingTimeout = setTimeout(() => {
        C.useBotsState.getState().dispatch.onEngineIncoming(action)
        C.useChatState.getState().dispatch.onEngineIncoming(action)
        C.useConfigState.getState().dispatch.dynamic.onEngineIncomingDesktop?.(action)
        C.useConfigState.getState().dispatch.dynamic.onEngineIncomingNative?.(action)
        C.useConfigState.getState().dispatch.onEngineIncoming(action)
        C.useDeepLinksState.getState().dispatch.onEngineIncoming(action)
        C.useFSState.getState().dispatch.onEngineIncoming(action)
        C.useArchiveState.getState().dispatch.onEngineIncoming(action)
        C.useNotifState.getState().dispatch.onEngineIncoming(action)
        C.usePeopleState.getState().dispatch.onEngineIncoming(action)
        C.usePinentryState.getState().dispatch.onEngineIncoming(action)
        C.useSettingsState.getState().dispatch.onEngineIncoming(action)
        C.useSignupState.getState().dispatch.onEngineIncoming(action)
        C.useTeamsState.getState().dispatch.onEngineIncoming(action)
        C.useTrackerState.getState().dispatch.onEngineIncoming(action)
        C.useUFState.getState().dispatch.onEngineIncoming(action)
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
