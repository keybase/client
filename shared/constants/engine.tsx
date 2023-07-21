import * as Z from '../util/zustand'
import * as PinentryConstants from './pinentry'
import * as TrackerConstants from './tracker2'
import * as ConfigConstants from './config'
import * as UnlockFolderConstants from './unlock-folders'
import * as PeopleConstants from './people'
import * as NotifConstants from './notifications'
import * as ChatConstants from './chat2'

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
      PinentryConstants.useState.getState().dispatch.onEngineConnected()
      TrackerConstants.useState.getState().dispatch.onEngineConnected()
      ConfigConstants.useConfigState.getState().dispatch.onEngineConnected()
      UnlockFolderConstants.useState.getState().dispatch.onEngineConnected()
      PeopleConstants.useState.getState().dispatch.onEngineConnected()
      NotifConstants.useState.getState().dispatch.onEngineConnected()
      ChatConstants.useState.getState().dispatch.onEngineConnected()
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
