// @flow
import {connect, compose, lifecycle, type TypedState} from '../../util/container'
import * as FsGen from '../../actions/fs-gen'
import InstallSecurityPrefs from './security-prefs.desktop'
import {navigateUp} from '../../actions/route-tree'
import {isLinux} from '../../constants/platform'

const mapStateToProps = (state: TypedState) => {
  const kbfsEnabled = isLinux || (state.fs.fuseStatus && state.fs.fuseStatus.kextStarted)
  return {
    appFocusedCount: state.config.appFocusedCount,
    needAction: !kbfsEnabled && state.fs.flags.kextPermissionError,
  }
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  back: () => dispatch(navigateUp()),
  openSecurityPrefs: () => dispatch(FsGen.createOpenSecurityPreferences()),
  _getFuseStatus: () => dispatch(FsGen.createFuseStatus()),
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps, (s, d, o) => ({...o, ...s, ...d})),
  lifecycle({
    componentDidUpdate(prevProps) {
      if (this.props.appFocusedCount !== prevProps.appFocusedCount) {
        // If the window is recently re-focused, it's possible that user has
        // gone to the security preferences to allow the kext. So check again.
        this.props._getFuseStatus()
      }
    },
  })
)(InstallSecurityPrefs)
