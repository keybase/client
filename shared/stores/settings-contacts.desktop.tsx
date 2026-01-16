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

export const useSettingsContactsState = Z.createZustand<State>(() => {
  const dispatch: State['dispatch'] = {
    editContactImportEnabled: () => {},
    importContactsLater: () => {},
    loadContactImportEnabled: () => {},
    loadContactPermissions: () => {},
    manageContactsCache: () => {},
    requestPermissions: () => {},
    resetState: 'default',
  }
  return {
    ...initialStore,
    dispatch,
  }
})
