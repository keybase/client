import * as Z from '@/util/zustand'
import type {Store, State} from './settings-contacts'

const initialStore: Store = {
  alreadyOnKeybase: [],
  importError: '',
  importPromptDismissed: false,
  importedCount: undefined,
  permissionStatus: 'unknown',
  userCountryCode: undefined,
  waitingToShowJoinedModal: false,
}

export const useSettingsContactsState = Z.createZustand<State>('settings-contacts', () => {
  const dispatch: Z.InitialDispatch<State['dispatch']> = {
    editContactImportEnabled: () => {},
    importContactsLater: () => {},
    loadContactImportEnabled: () => {},
    loadContactPermissions: () => {},
    manageContactsCache: () => {},
    requestPermissions: () => {},
  }
  return {
    ...initialStore,
    resetStateDefault: true,
    dispatch,
  }
})
