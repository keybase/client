import * as Z from '@/util/zustand'
import type {Store, State} from './settings-contacts'

const initialStore: Store = {
  permissionStatus: 'unknown',
  syncGeneration: 0,
  userCountryCode: undefined,
}

export const useSettingsContactsState = Z.createZustand<State>('settings-contacts', () => {
  const dispatch: State['dispatch'] = {
    editContactImportEnabled: async () => {},
    loadContactImportEnabled: async () => {},
    loadContactPermissions: async () => 'unknown',
    notifySyncSucceeded: () => {},
    requestPermissions: async () => 'unknown',
    resetState: Z.defaultReset,
  }
  return {
    ...initialStore,
    dispatch,
  }
})
