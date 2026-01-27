import type * as T from '@/constants/types'
import type {UseBoundStore, StoreApi} from 'zustand'

type Store = T.Immutable<{
  hasPermissions: boolean
  justSignedUp: boolean
  showPushPrompt: boolean
  token: string
}>

export type State = Store & {
  dispatch: {
    defer: {
      onGetDaemonHandshakeState?: () => T.Config.DaemonHandshakeState
      onNavigateToThread?: (
        conversationIDKey: T.Chat.ConversationIDKey,
        reason: 'push' | 'extension',
        pushBody?: string
      ) => void
      onShowUserProfile?: (username: string) => void
    }
    checkPermissions: () => Promise<boolean>
    deleteToken: (version: number) => void
    handlePush: (notification: T.Push.PushNotification) => void
    initialPermissionsCheck: () => void
    rejectPermissions: () => void
    requestPermissions: () => void
    setPushToken: (token: string) => void
    showPermissionsPrompt: (p: {show?: boolean; persistSkip?: boolean; justSignedUp?: boolean}) => void
    resetState: 'default'
  }
}

declare const usePushState: UseBoundStore<StoreApi<State>>
declare const permissionsRequestingWaitingKey: string
declare const tokenType: 'appledev' | 'apple' | 'androidplay'
