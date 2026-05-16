import type * as T from '@/constants/types'

type PermissionStatus = 'granted' | 'denied' | 'undetermined' | 'unknown'

type Store = T.Immutable<{
  alreadyOnKeybase: Array<T.RPCGen.ProcessedContact>
  importEnabled?: boolean
  importError: string
  importPromptDismissed: boolean
  importedCount?: number
  permissionStatus: PermissionStatus
  userCountryCode?: string
  waitingToShowJoinedModal: boolean
}>

export type State = Store & {
  dispatch: {
    importContactsLater: () => void
    editContactImportEnabled: (enable: boolean, fromSettings?: boolean) => void
    loadContactPermissions: () => void
    loadContactImportEnabled: () => void
    manageContactsCache: () => void
    requestPermissions: (thenToggleImportOn?: boolean, fromSettings?: boolean) => void
    resetState: () => void
  }
}
