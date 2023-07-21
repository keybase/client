import * as Z from '../util/zustand'

type Store = {}
const initialStore: Store = {}

type State = Store & {
  dispatch: {
    connected: () => void
    disconnected: () => void
    incomingCall: () => void
    resetState: 'default'
  }
}

export const useState = Z.createZustand<State>(() => {
  const dispatch: State['dispatch'] = {
    connected: () => {
      const f = async () => {
        const PinentryConstants = await import('./pinentry')
        PinentryConstants.useState.getState().dispatch.onEngineConnected()
        const TrackerConstants = await import('./tracker2')
        TrackerConstants.useState.getState().dispatch.onEngineConnected()
        const ConfigConstants = await import('./config')
        ConfigConstants.useConfigState.getState().dispatch.onEngineConnected()
        const UnlockFolderConstants = await import('./unlock-folders')
        UnlockFolderConstants.useState.getState().dispatch.onEngineConnected()
        const PeopleConstants = await import('./people')
        PeopleConstants.useState.getState().dispatch.onEngineConnected()
        const NotifConstants = await import('./notifications')
        NotifConstants.useState.getState().dispatch.onEngineConnected()
        const ChatConstants = await import('./chat2')
        ChatConstants.useState.getState().dispatch.onEngineConnected()
      }
      Z.ignorePromise(f())
    },
    disconnected: () => {},
    incomingCall: () => {},
    resetState: 'default',
  }
  return {
    ...initialStore,
    dispatch,
  }
})
