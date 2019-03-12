// @flow
import {namedConnect, type RouteProps} from '../../../util/container'
import * as FsGen from '../../../actions/fs-gen'
import KextPermissionPopup from './kext-permission-popup'

type OwnProps = RouteProps<{||}, {||}>

const mapStateToProps = state => ({
  driverStatus: state.fs.sfmi.driverStatus,
})

const mapDispatchToProps = (dispatch, ownProps) => ({
  onCancel: () => dispatch(ownProps.navigateUp()),
  openSecurityPrefs: () => dispatch(FsGen.createOpenSecurityPreferences()),
})

export default namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  (s, d, o) => ({
    driverStatus: s.driverStatus,
    onCancel: d.onCancel,
    openSecurityPrefs: d.openSecurityPrefs,
  }),
  'KextPermissionPopup'
)(KextPermissionPopup)
