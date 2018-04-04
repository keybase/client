// @flow
import Files from './index'
import * as FsGen from '../../actions/fs-gen'
import {connect, compose, lifecycle, type TypedState} from '../../util/container'
import {isLinux} from '../../constants/platform'

const mapStateToProps = (state: TypedState) => {
  const kbfsEnabled = isLinux || (state.fs.fuseStatus && state.fs.fuseStatus.kextStarted)
  return {
    kbfsEnabled,
    inProgress: state.fs.fuseInstalling || state.fs.kbfsInstalling || state.fs.kbfsOpening,
    showSecurityPrefs: !kbfsEnabled && state.fs.kextPermissionError,
  }
}

const mapDispatchToProps = (dispatch: Dispatch) => {
  const uninstall = () => dispatch(FsGen.createUninstallKBFS())
  return {
    getFuseStatus: () => dispatch(FsGen.createFuseStatus()),
    onInstall: () => dispatch(FsGen.createInstallFuse()),
    onUninstall: () => dispatch(FsGen.createUninstallKBFSConfirm({onSuccess: uninstall})),
  }
}

export default compose(
  connect(mapStateToProps, mapDispatchToProps),
  lifecycle({
    componentDidMount() {
      this.props.getFuseStatus()
    },
  })
)(Files)
