import type * as Types from './types/push'
import type {UseBoundStore, StoreApi} from 'zustand'

export type Store = {
  hasPermissions: boolean
  justSignedUp: boolean
  showPushPrompt: boolean
  token: string
}

export type State = Store & {
  dispatch: {
    checkPermissions: () => Promise<boolean>
    deleteToken: (version: number) => void
    handlePush: (notification: Types.PushNotification) => void
    initialPermissionsCheck: () => void
    rejectPermissions: () => void
    requestPermissions: () => void
    setPushToken: (token: string) => void
    showPermissionsPrompt: (p: {show?: boolean; persistSkip?: boolean; justSignedUp?: boolean}) => void
    resetState: 'default'
  }
}

declare const useState: UseBoundStore<StoreApi<State>>
declare const permissionsRequestingWaitingKey: string
declare const tokenType: 'appledev' | 'apple' | 'androidplay'
