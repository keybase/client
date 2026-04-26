import * as Z from '@/util/zustand'
import type {Store, State} from './settings-contacts'

const initialStore: Store = {
  alreadyOnKeybase: [],
  importError: '',
  importPromptDismissed: false,
  permissionStatus: 'unknown',
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
