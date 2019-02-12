// @flow
import {connect, compose, lifecycle} from '../../util/container'
import * as FsGen from '../../actions/fs-gen'
import * as Constants from '../../constants/fs'
import InstallSecurityPrefs from './security-prefs.desktop'
import * as RouteTreeGen from '../../actions/route-tree-gen'

type OwnProps = {||}

const mapStateToProps = state => {
  const kbfsEnabled = Constants.kbfsEnabled(state)
  return {
    _appFocusedCount: state.config.appFocusedCount,
    needAction: !kbfsEnabled && state.fs.flags.kextPermissionError,
  }
}

const mapDispatchToProps = dispatch => ({
  _getFuseStatus: () => dispatch(FsGen.createFuseStatus()),
  back: () => dispatch(RouteTreeGen.createNavigateUp()),
  openSecurityPrefs: () => dispatch(FsGen.createOpenSecurityPreferences()),
})

export default compose(
  connect<OwnProps, _, _, _, _>(
    mapStateToProps,
    mapDispatchToProps,
    (s, d, o) => ({...o, ...s, ...d})
  ),
  lifecycle({
    componentDidUpdate(prevProps) {
      if (this.props._appFocusedCount !== prevProps._appFocusedCount) {
        // If the window is recently re-focused, it's possible that user has
        // gone to the security preferences to allow the kext. So check again.
        this.props._getFuseStatus()
      }
    },
  })
)(InstallSecurityPrefs)
