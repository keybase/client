import * as Z from '@/util/zustand'
import type {Store, State} from './settings-contacts'

export const importContactsWaitingKey = 'settings:importContacts'

const initialStore: Store = {
  alreadyOnKeybase: [],
  importError: '',
  importPromptDismissed: false,
  importedCount: undefined,
  permissionStatus: 'unknown',
  userCountryCode: undefined,
  waitingToShowJoinedModal: false,
}

export const _useState = Z.createZustand<State>(() => {
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
