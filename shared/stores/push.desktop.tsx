import * as Z from '@/util/zustand'
import {type Store, type State} from '@/stores/push'

export const tokenType = ''

const initialStore: Store = {
  hasPermissions: false,
  justSignedUp: false,
  showPushPrompt: false,
  token: '',
}

export const usePushState = Z.createZustand<State>('push', () => {
  const dispatch: Z.InitialDispatch<State['dispatch']> = {
    checkPermissions: async () => {
      return Promise.resolve(false)
    },
    clearPendingPushNotification: () => {},
    defer: {
      onGetDaemonHandshakeState: () => {
        return 'done'
      },
    },
    deleteToken: () => {},
    handlePush: () => {},
    initialPermissionsCheck: () => {},
    rejectPermissions: () => {},
    requestPermissions: () => {},
    setPushToken: () => {},
    showPermissionsPrompt: () => {},
  }
  return {
    ...initialStore,
    resetStateDefault: true,
    dispatch,
  }
})
