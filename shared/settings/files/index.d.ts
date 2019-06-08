import * as React from 'react'
import * as Types from '../../constants/types/fs'

export type Props = {
  areSettingsLoading: boolean
  driverStatus: Types.DriverStatus
  onDisable: () => void
  onEnable: () => void
  onEnableSyncNotifications: () => void
  onShowKextPermissionPopup: () => void
  onChangedSyncNotifications: (number) => void
  onDisableSyncNotifications: () => void
  spaceAvailableNotificationThreshold: number
}

export declare const allowedNotificationThresholds: Array<number>

export declare const defaultNotificationThreshold: number

export default class PaymentForm extends React.Component<Props> {}
