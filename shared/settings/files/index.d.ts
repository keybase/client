import type * as React from 'react'
import type * as T from '@/constants/types'
import type {PickerItem} from '@/common-adapters/floating-picker'

export type Props = {
  title?: string
  onBack?: () => void
  allowedThresholds: Array<PickerItem<number>>
  areSettingsLoading: boolean
  driverStatus: T.FS.DriverStatus
  humanizedNotificationThreshold: string
  onDisable: () => void
  onEnable: () => void
  onEnableSyncNotifications: () => void
  onShowKextPermissionPopup: () => void
  onChangedSyncNotifications: (n: number) => void
  onSetSyncNotificationThreshold: (n: number) => void
  onDisableSyncNotifications: () => void
  spaceAvailableNotificationThreshold: number
}
export declare const allowedNotificationThresholds: Array<number>
export declare const defaultNotificationThreshold: number
declare const PaymentForm: (p: Props) => React.ReactNode
export default PaymentForm
