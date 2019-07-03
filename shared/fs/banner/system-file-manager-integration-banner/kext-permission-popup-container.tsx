import {namedConnect, RouteProps} from '../../../util/container'
import * as FsGen from '../../../actions/fs-gen'
import KextPermissionPopup from './kext-permission-popup'
import * as RouteTreeGen from '../../../actions/route-tree-gen'

const mapStateToProps = state => ({
  driverStatus: state.fs.sfmi.driverStatus,
})

const mapDispatchToProps = (dispatch, ownProps) => ({
  onCancel: () => dispatch(RouteTreeGen.createNavigateUp()),
  openSecurityPrefs: () => dispatch(FsGen.createOpenSecurityPreferences()),
})

export default namedConnect(
  mapStateToProps,
  mapDispatchToProps,
  (s, d, o) => ({
    driverStatus: s.driverStatus,
    onCancel: d.onCancel,
    openSecurityPrefs: d.openSecurityPrefs,
  }),
  'KextPermissionPopup'
)(KextPermissionPopup)
