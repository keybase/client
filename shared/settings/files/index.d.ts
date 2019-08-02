import * as React from 'react'
import * as Types from '../../constants/types/fs'
import {PickerItem} from '../../common-adapters/floating-picker'

export type Props = {
  title?: string,
  onBack?: () => void,
  allowedThresholds: Array<PickerItem<number>>
  areSettingsLoading: boolean
  driverStatus: Types.DriverStatus
  humanizedNotificationThreshold: string
  onDisable: () => void
  onEnable: () => void
  onEnableSyncNotifications: () => void
  onShowKextPermissionPopup: () => void
  onChangedSyncNotifications: (number) => void
  onSetSyncNotificationThreshold: (number) => void
  onDisableSyncNotifications: () => void
  spaceAvailableNotificationThreshold: number
}

export declare const allowedNotificationThresholds: Array<number>

export declare const defaultNotificationThreshold: number

export default class PaymentForm extends React.Component<Props> {}
