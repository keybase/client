import * as Z from '../util/zustand'
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

export const useState = Z.createZustand<State>(() => {
  const dispatch: State['dispatch'] = {
    onEngineConnected: () => {
      const f = async () => {
        const ChatConstants = await import('./chat2')
        const ConfigConstants = await import('./config')
        const NotifConstants = await import('./notifications')
        const PeopleConstants = await import('./people')
        const PinentryConstants = await import('./pinentry')
        const TrackerConstants = await import('./tracker2')
        const UnlockFolderConstants = await import('./unlock-folders')
        ChatConstants.useState.getState().dispatch.onEngineConnected()
        ConfigConstants.useConfigState.getState().dispatch.onEngineConnected()
        NotifConstants.useState.getState().dispatch.onEngineConnected()
        PeopleConstants.useState.getState().dispatch.onEngineConnected()
        PinentryConstants.useState.getState().dispatch.onEngineConnected()
        TrackerConstants.useState.getState().dispatch.onEngineConnected()
        UnlockFolderConstants.useState.getState().dispatch.onEngineConnected()
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
        const BotsConstants = await import('./bots')
        const ChatConstants = await import('./chat2')
        const ConfigConstants = await import('./config')
        const DLConstants = await import('./deeplinks')
        const FSConstants = await import('./fs')
        const NotifConstants = await import('./notifications')
        const PeopleConstants = await import('./people')
        const PinConstants = await import('./pinentry')
        const SettingsConstants = await import('./settings')
        const SignupConstants = await import('./signup')
        const TeamsConstants = await import('./teams')
        const TrackerConstants = await import('./tracker2')
        const UnlockConstants = await import('./unlock-folders')
        const UsersConstants = await import('./users')
        BotsConstants.useState.getState().dispatch.onEngineIncoming(action)
        ChatConstants.useState.getState().dispatch.onEngineIncoming(action)
        ConfigConstants.useConfigState.getState().dispatch.dynamic.onEngineIncomingDesktop?.(action)
        ConfigConstants.useConfigState.getState().dispatch.dynamic.onEngineIncomingNative?.(action)
        ConfigConstants.useConfigState.getState().dispatch.onEngineIncoming(action)
        DLConstants.useState.getState().dispatch.onEngineIncoming(action)
        FSConstants.useState.getState().dispatch.onEngineIncoming(action)
        NotifConstants.useState.getState().dispatch.onEngineIncoming(action)
        PeopleConstants.useState.getState().dispatch.onEngineIncoming(action)
        PinConstants.useState.getState().dispatch.onEngineIncoming(action)
        SettingsConstants.useState.getState().dispatch.onEngineIncoming(action)
        SignupConstants.useState.getState().dispatch.onEngineIncoming(action)
        TeamsConstants.useState.getState().dispatch.onEngineIncoming(action)
        TrackerConstants.useState.getState().dispatch.onEngineIncoming(action)
        UnlockConstants.useState.getState().dispatch.onEngineIncoming(action)
        UsersConstants.useState.getState().dispatch.onEngineIncoming(action)
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
