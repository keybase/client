import Files, {defaultNotificationThreshold, allowedNotificationThresholds} from '.'
import * as FsGen from '../../actions/fs-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import {namedConnect} from '../../util/container'
import {isMobile} from '../../constants/platform'

type OwnProps = {}
const mapStateToProps = state => ({
  areSettingsLoading: state.fs.settings.isLoading,
  driverStatus: state.fs.sfmi.driverStatus,
  spaceAvailableNotificationThreshold: state.fs.settings.spaceAvailableNotificationThreshold,
})

const mapDispatchToProps = dispatch => ({
  _onEnableSyncNotifications: (threshold: number) =>
    dispatch(
      FsGen.createSetSpaceAvailableNotificationThreshold({spaceAvailableNotificationThreshold: threshold})
    ),
  onDisable: () => dispatch(FsGen.createDriverDisable()),
  onDisableSyncNotifications: () =>
    dispatch(FsGen.createSetSpaceAvailableNotificationThreshold({spaceAvailableNotificationThreshold: 0})),
  onEnable: () => dispatch(FsGen.createDriverEnable({})),
  onShowKextPermissionPopup: () => dispatch(RouteTreeGen.createNavigateAppend({path: ['kextPermission']})),
})

const SettingsFiles = namedConnect(
  mapStateToProps,
  mapDispatchToProps,
  (s, d, o) => ({
    ...s,
    ...o,
    onChangedSyncNotifications: (selectedIdx: number) =>
      d._onEnableSyncNotifications(allowedNotificationThresholds[selectedIdx]),
    onDisable: d.onDisable,
    onDisableSyncNotifications: d.onDisableSyncNotifications,
    onEnable: d.onEnable,
    onEnableSyncNotifications: () => d._onEnableSyncNotifications(defaultNotificationThreshold),
    onShowKextPermissionPopup: d.onShowKextPermissionPopup,
  }),
  'SettingsFiles'
)(Files)

export default SettingsFiles
