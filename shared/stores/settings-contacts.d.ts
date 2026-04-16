import type * as T from '@/constants/types'
import type {UseBoundStore, StoreApi} from 'zustand'
type PermissionStatus = 'granted' | 'denied' | 'undetermined' | 'unknown'

type Store = T.Immutable<{
  importEnabled?: boolean
  // OS permissions. 'undetermined' -> we can show the prompt; 'unknown' -> we haven't checked
  permissionStatus: PermissionStatus
  syncGeneration: number
  userCountryCode?: string
}>

export type State = Store & {
  dispatch: {
    editContactImportEnabled: (enable: boolean) => Promise<void>
    loadContactPermissions: () => Promise<PermissionStatus>
    loadContactImportEnabled: () => Promise<void>
    notifySyncSucceeded: (userCountryCode?: string) => void
    requestPermissions: () => Promise<PermissionStatus>
    resetState: () => void
  }
}

declare const useSettingsContactsState: UseBoundStore<StoreApi<State>>
