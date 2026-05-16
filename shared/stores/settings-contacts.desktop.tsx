import * as Z from '@/util/zustand'
import type {State} from '@/stores/settings-contacts.shared'

const initialStore: Omit<State, 'dispatch'> = {
  alreadyOnKeybase: [],
  importError: '',
  importPromptDismissed: false,
  importedCount: undefined,
  permissionStatus: 'unknown',
  userCountryCode: undefined,
  waitingToShowJoinedModal: false,
}

export const useSettingsContactsState = Z.createZustand<State>('settings-contacts', () => {
  const dispatch: State['dispatch'] = {
    editContactImportEnabled: () => {},
    importContactsLater: () => {},
    loadContactImportEnabled: () => {},
    loadContactPermissions: () => {},
    manageContactsCache: () => {},
    requestPermissions: () => {},
    resetState: Z.defaultReset,
  }
  return {
    ...initialStore,
    dispatch,
  }
})
