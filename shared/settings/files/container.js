// @flow
import Files from '.'
import * as FsGen from '../../actions/fs-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import {namedConnect} from '../../util/container'
import {isMobile} from '../../constants/platform'

type OwnProps = {||}
const mapStateToProps = state => ({
  driverStatus: state.fs.fileUI.driverStatus,
})

const mapDispatchToProps = dispatch => ({
  onDisable: () => dispatch(FsGen.createDriverDisable()),
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
        ...d,
        ...o,
      }),
      'SettingsFiles'
    )(Files))
