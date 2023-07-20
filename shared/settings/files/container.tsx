import * as Constants from '../../constants/fs'
import * as RouterConstants from '../../constants/router2'
import Files, {defaultNotificationThreshold, allowedNotificationThresholds} from '.'
import type {PickerItem} from '../../common-adapters/floating-picker'
import {isMobile} from '../../constants/platform'

const SettingsFiles = () => {
  const areSettingsLoading = Constants.useState(s => s.settings.isLoading)
  const driverEnable = Constants.useState(s => s.dispatch.driverEnable)
  const driverDisable = Constants.useState(s => s.dispatch.driverDisable)
  const driverStatus = Constants.useState(s => s.sfmi.driverStatus)
  const setSpaceAvailableNotificationThreshold = Constants.useState(
    s => s.dispatch.setSpaceAvailableNotificationThreshold
  )
  const spaceAvailableNotificationThreshold = Constants.useState(
    s => s.settings.spaceAvailableNotificationThreshold
  )
  const navigateUp = RouterConstants.useState(s => s.dispatch.navigateUp)
  const onBack = isMobile
    ? () => {
        navigateUp()
      }
    : undefined
  const onDisable = driverDisable
  const onDisableSyncNotifications = () => {
    setSpaceAvailableNotificationThreshold(0)
  }
  const onEnable = () => {
    driverEnable()
  }
  const onSetSyncNotificationThreshold = setSpaceAvailableNotificationThreshold
  const navigateAppend = RouterConstants.useState(s => s.dispatch.navigateAppend)
  const onShowKextPermissionPopup = () => {
    navigateAppend('kextPermission')
  }
  const props = {
    allowedThresholds: allowedNotificationThresholds.map(
      i =>
        ({
          label: Constants.humanizeBytes(i, 0),
          value: i,
        }) as PickerItem<number>
    ),
    areSettingsLoading,
    driverStatus,
    humanizedNotificationThreshold: Constants.humanizeBytes(
      spaceAvailableNotificationThreshold || defaultNotificationThreshold,
      0
    ),
    onBack,
    onChangedSyncNotifications: (selectedIdx: number) =>
      onSetSyncNotificationThreshold(allowedNotificationThresholds[selectedIdx] ?? 0),
    onDisable,
    onDisableSyncNotifications,
    onEnable,
    onEnableSyncNotifications: () => onSetSyncNotificationThreshold(defaultNotificationThreshold),
    onSetSyncNotificationThreshold,
    onShowKextPermissionPopup,
    spaceAvailableNotificationThreshold,
  }
  return <Files {...props} />
}

export default SettingsFiles
