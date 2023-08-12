import * as Z from '../util/zustand'
import {type Store, type State} from './push'

export const permissionsRequestingWaitingKey = 'push:permissionsRequesting'
export const tokenType = ''

const initialStore: Store = {
  hasPermissions: false,
  justSignedUp: false,
  showPushPrompt: false,
  token: '',
}

export const _useState = Z.createZustand<State>(() => {
  const dispatch: State['dispatch'] = {
    checkPermissions: async () => {
      return Promise.resolve(false)
    },
    deleteToken: () => {},
    handlePush: () => {},
    initialPermissionsCheck: () => {},
    rejectPermissions: () => {},
    requestPermissions: () => {},
    resetState: 'default',
    setPushToken: () => {},
    showPermissionsPrompt: () => {},
  }
  return {
    ...initialStore,
    dispatch,
  }
})
