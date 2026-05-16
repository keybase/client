import type * as T from '@/constants/types'

export type Store = {
  hasPermissions: boolean
  justSignedUp: boolean
  pendingPushNotification?: T.Push.PushNotification
  showPushPrompt: boolean
  token: string
}

export type State = Store & {
  dispatch: {
    checkPermissions: () => Promise<boolean>
    clearPendingPushNotification: () => void
    deleteToken: (version: number) => void
    handlePush: (notification: T.Push.PushNotification) => void
    initialPermissionsCheck: () => void
    rejectPermissions: () => void
    requestPermissions: () => void
    resetState: () => void
    setPendingPushNotification: (notification: T.Push.PushNotification) => void
    setPushToken: (token: string) => void
    showPermissionsPrompt: (p: {show?: boolean; persistSkip?: boolean; justSignedUp?: boolean}) => void
  }
}
