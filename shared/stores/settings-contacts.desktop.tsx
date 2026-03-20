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
  const dispatch = {
    resetState: Z.defaultReset,
    editContactImportEnabled: () => {},
    importContactsLater: () => {},
    loadContactImportEnabled: () => {},
    loadContactPermissions: () => {},
    manageContactsCache: () => {},
    requestPermissions: () => {},
  } satisfies State['dispatch']
  return {
    ...initialStore,
    dispatch,
  }
})
