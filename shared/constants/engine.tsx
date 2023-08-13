import * as Z from '../util/zustand'
import * as C from '.'
import type * as EngineGen from '../actions/engine-gen-gen'

type Store = {}
const initialStore: Store = {}

type State = Store & {
  dispatch: {
    onEngineConnected: () => void
    onEngineDisconnected: () => void
    onEngineIncoming: (action: EngineGen.Actions) => void
    resetState: 'default'
  }
}

export const _useState = Z.createZustand<State>(() => {
  const dispatch: State['dispatch'] = {
    onEngineConnected: () => {
      const f = async () => {
        const ChatConstants = await import('./chat2')
        const ConfigConstants = await import('./config')
        ChatConstants.useState.getState().dispatch.onEngineConnected()
        ConfigConstants.useConfigState.getState().dispatch.onEngineConnected()
        C.useNotifState.getState().dispatch.onEngineConnected()
        C.usePeopleState.getState().dispatch.onEngineConnected()
        C.usePinentryState.getState().dispatch.onEngineConnected()
        C.useTrackerState.getState().dispatch.onEngineConnected()
        C.useUFState.getState().dispatch.onEngineConnected()
      }
      Z.ignorePromise(f())
    },
    onEngineDisconnected: () => {
      const f = async () => {
        const ConfigConstants = await import('./config')
        ConfigConstants.useConfigState.getState().dispatch.onEngineDisonnected()
      }
      Z.ignorePromise(f())
    },
    onEngineIncoming: action => {
      const f = async () => {
        const ChatConstants = await import('./chat2')
        const ConfigConstants = await import('./config')
        C.useBotsState.getState().dispatch.onEngineIncoming(action)
        ChatConstants.useState.getState().dispatch.onEngineIncoming(action)
        ConfigConstants.useConfigState.getState().dispatch.dynamic.onEngineIncomingDesktop?.(action)
        ConfigConstants.useConfigState.getState().dispatch.dynamic.onEngineIncomingNative?.(action)
        ConfigConstants.useConfigState.getState().dispatch.onEngineIncoming(action)
        C.useDeepLinksState.getState().dispatch.onEngineIncoming(action)
        C.useFSState.getState().dispatch.onEngineIncoming(action)
        C.useNotifState.getState().dispatch.onEngineIncoming(action)
        C.usePeopleState.getState().dispatch.onEngineIncoming(action)
        C.usePinentryState.getState().dispatch.onEngineIncoming(action)
        C.useSettingsState.getState().dispatch.onEngineIncoming(action)
        C.useSignupState.getState().dispatch.onEngineIncoming(action)
        C.useTeamsState.getState().dispatch.onEngineIncoming(action)
        C.useTrackerState.getState().dispatch.onEngineIncoming(action)
        C.useUFState.getState().dispatch.onEngineIncoming(action)
        C.useUsersState.getState().dispatch.onEngineIncoming(action)
      }
      Z.ignorePromise(f())
    },
    resetState: 'default',
  }
  return {
    ...initialStore,
    dispatch,
  }
})
