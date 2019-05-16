// @flow
import Files from '.'
import * as FsGen from '../../actions/fs-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import {namedConnect} from '../../util/container'
import {isMobile} from '../../constants/platform'

type OwnProps = {||}
const mapStateToProps = state => ({
  driverStatus: state.fs.sfmi.driverStatus,
  spaceAvailableNotificationThreshold: state.fs.settings.spaceAvailableNotificationThreshold,
})

const mapDispatchToProps = dispatch => ({
  _onEnableSyncNotifications: (threshold: number) => dispatch(FsGen.createSetSpaceAvailableNotificationThreshold({spaceAvailableNotificationThreshold: threshold})),
  onDisable: () => dispatch(FsGen.createDriverDisable()),
  onDisableSyncNotifications: () => dispatch(FsGen.createSetSpaceAvailableNotificationThreshold({spaceAvailableNotificationThreshold: 0})),
  onEnable: () => dispatch(FsGen.createDriverEnable({})),
  onShowKextPermissionPopup: () => dispatch(RouteTreeGen.createNavigateAppend({path: ['kextPermission']})),
})

export default (isMobile
  ? () => null
  : namedConnect<OwnProps, _, _, _, _>(
      mapStateToProps,
      mapDispatchToProps,
      (s, d, o) => ({
        ...s,
        ...o,
        onDisable: d.onDisable,
        onDisableSyncNotifications: d.onDisableSyncNotifications,
        onEnable: d.onEnable,
        onEnableSyncNotifications: () => d._onEnableSyncNotifications(100), // TODO: fix the threshold
        onShowKextPermissionPopup: d.onShowKextPermissionPopup,
      }),
      'SettingsFiles'
    )(Files))
