import type * as T from './types'
import type {UseBoundStore, StoreApi} from 'zustand'
type PermissionStatus = 'granted' | 'denied' | 'undetermined' | 'unknown'

export type Store = T.Immutable<{
  alreadyOnKeybase: Array<T.RPCGen.ProcessedContact>
  importEnabled?: boolean
  importError: string
  importPromptDismissed: boolean
  importedCount?: number
  // OS permissions. 'undetermined' -> we can show the prompt; 'unknown' -> we haven't checked
  permissionStatus: PermissionStatus
  userCountryCode?: string
  waitingToShowJoinedModal: boolean
}>

export interface State extends Store {
  dispatch: {
    importContactsLater: () => void
    editContactImportEnabled: (enable: boolean, fromSettings?: boolean) => void
    loadContactPermissions: () => void
    loadContactImportEnabled: () => void
    manageContactsCache: () => void
    requestPermissions: (thenToggleImportOn?: boolean, fromSettings?: boolean) => void
    resetState: 'default' | (() => void)
  }
}

declare const _useState: UseBoundStore<StoreApi<State>>

declare const importContactsWaitingKey: string
