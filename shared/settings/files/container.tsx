import Files, {defaultNotificationThreshold, allowedNotificationThresholds} from '.'
import * as Constants from '../../constants/fs'
import * as FsGen from '../../actions/fs-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import {namedConnect} from '../../util/container'
import {isMobile} from '../../constants/platform'

type OwnProps = {}
const mapStateToProps = state => ({
  areSettingsLoading: state.fs.settings.isLoading,
  driverStatus: state.fs.sfmi.driverStatus,
  spaceAvailableNotificationThreshold: state.fs.settings.spaceAvailableNotificationThreshold,
  title: 'Files',
})

const mapDispatchToProps = dispatch => ({
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
})

const SettingsFiles = namedConnect(
  mapStateToProps,
  mapDispatchToProps,
  (s, d, o) => ({
    ...s,
    ...o,
    ...d,
    allowedThresholds: allowedNotificationThresholds.map(i => ({
      label: Constants.humanizeBytes(i, 0),
      value: i,
    })),
    humanizedNotificationThreshold: Constants.humanizeBytes(
      s.spaceAvailableNotificationThreshold || defaultNotificationThreshold,
      0
    ),
    onChangedSyncNotifications: (selectedIdx: number) =>
      d.onSetSyncNotificationThreshold(allowedNotificationThresholds[selectedIdx]),
    onEnableSyncNotifications: () => d.onSetSyncNotificationThreshold(defaultNotificationThreshold),
  }),
  'SettingsFiles'
)(Files)

export default SettingsFiles
