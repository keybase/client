import * as C from '../../constants'
import * as Constants from '../../constants/fs'
import Files, {defaultNotificationThreshold, allowedNotificationThresholds} from '.'
import type {PickerItem} from '../../common-adapters/floating-picker'
import {isMobile} from '../../constants/platform'

const SettingsFiles = () => {
  const areSettingsLoading = C.useFSState(s => s.settings.isLoading)
  const driverEnable = C.useFSState(s => s.dispatch.driverEnable)
  const driverDisable = C.useFSState(s => s.dispatch.driverDisable)
  const driverStatus = C.useFSState(s => s.sfmi.driverStatus)
  const setSpaceAvailableNotificationThreshold = C.useFSState(
    s => s.dispatch.setSpaceAvailableNotificationThreshold
  )
  const spaceAvailableNotificationThreshold = C.useFSState(
    s => s.settings.spaceAvailableNotificationThreshold
  )
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
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
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
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
