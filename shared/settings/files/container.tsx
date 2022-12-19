import Files, {defaultNotificationThreshold, allowedNotificationThresholds} from '.'
import * as Constants from '../../constants/fs'
import * as FsGen from '../../actions/fs-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Container from '../../util/container'
import {isMobile} from '../../constants/platform'
import type {PickerItem} from '../../common-adapters/floating-picker'

type OwnProps = {}
const SettingsFiles = Container.connect(
  state => ({
    areSettingsLoading: state.fs.settings.isLoading,
    driverStatus: state.fs.sfmi.driverStatus,
    spaceAvailableNotificationThreshold: state.fs.settings.spaceAvailableNotificationThreshold,
  }),
  dispatch => ({
    onBack: isMobile ? () => dispatch(RouteTreeGen.createNavigateUp()) : undefined,
    onDisable: () => dispatch(FsGen.createDriverDisable()),
    onDisableSyncNotifications: () =>
      dispatch(FsGen.createSetSpaceAvailableNotificationThreshold({spaceAvailableNotificationThreshold: 0})),
    onEnable: () => dispatch(FsGen.createDriverEnable({})),
    onSetSyncNotificationThreshold: (threshold: number) =>
      dispatch(
        FsGen.createSetSpaceAvailableNotificationThreshold({spaceAvailableNotificationThreshold: threshold})
      ),
    onShowKextPermissionPopup: () => dispatch(RouteTreeGen.createNavigateAppend({path: ['kextPermission']})),
  }),

  (s, d, o: OwnProps) => ({
    ...s,
    ...o,
    ...d,
    allowedThresholds: allowedNotificationThresholds.map(
      i =>
        ({
          label: Constants.humanizeBytes(i, 0),
          value: i,
        } as PickerItem<number>)
    ),
    humanizedNotificationThreshold: Constants.humanizeBytes(
      s.spaceAvailableNotificationThreshold || defaultNotificationThreshold,
      0
    ),
    onChangedSyncNotifications: (selectedIdx: number) =>
      d.onSetSyncNotificationThreshold(allowedNotificationThresholds[selectedIdx]),
    onEnableSyncNotifications: () => d.onSetSyncNotificationThreshold(defaultNotificationThreshold),
  })
)(Files)

export default SettingsFiles
