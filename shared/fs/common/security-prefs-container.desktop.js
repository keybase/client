// @flow
import {connect, compose, lifecycle} from '../../util/container'
import * as FsGen from '../../actions/fs-gen'
import InstallSecurityPrefs from './security-prefs.desktop'
import {navigateUp} from '../../actions/route-tree'
import {isLinux} from '../../constants/platform'

type OwnProps = {||}

const mapStateToProps = state => {
  const kbfsEnabled = isLinux || (state.fs.fuseStatus && state.fs.fuseStatus.kextStarted)
  return {
    needAction: !kbfsEnabled && state.fs.flags.kextPermissionError,
    _appFocusedCount: state.config.appFocusedCount,
  }
}

const mapDispatchToProps = dispatch => ({
  back: () => dispatch(navigateUp()),
  openSecurityPrefs: () => dispatch(FsGen.createOpenSecurityPreferences()),
  _getFuseStatus: () => dispatch(FsGen.createFuseStatus()),
})

export default compose(
  connect<OwnProps, _, _, _, _>(
    mapStateToProps,
    mapDispatchToProps,
    (s, d, o) => ({...o, ...s, ...d}),
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
