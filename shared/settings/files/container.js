// @flow
import Files from './index'
import * as FsGen from '../../actions/fs-gen'
import {connect, compose, lifecycle, type TypedState} from '../../util/container'
import {isLinux} from '../../constants/platform'
import {SecurityPrefsHoc} from '../../fs/common/hocs'
import {navigateAppend} from '../../actions/route-tree'

const mapStateToProps = (state: TypedState) => {
  const kbfsEnabled = isLinux || (state.fs.fuseStatus && state.fs.fuseStatus.kextStarted)
  return {
    kbfsEnabled,
    inProgress: state.fs.flags.fuseInstalling || state.fs.flags.kbfsInstalling || state.fs.flags.kbfsOpening,
    showSecurityPrefsLink: !kbfsEnabled && state.fs.flags.kextPermissionError,
  }
}

const mapDispatchToProps = (dispatch: Dispatch) => {
  const uninstall = () => dispatch(FsGen.createUninstallKBFS())
  return {
    getFuseStatus: () => dispatch(FsGen.createFuseStatus()),
    onInstall: () => dispatch(FsGen.createInstallFuse()),
    onUninstall: () => dispatch(FsGen.createUninstallKBFSConfirm({onSuccess: uninstall})),
    showSecurityPrefs: () => dispatch(navigateAppend([{selected: 'securityPrefs'}])),
  }
}

const ConnectedFiles = compose(
  connect(mapStateToProps, mapDispatchToProps),
  lifecycle({
    componentDidMount() {
      this.props.getFuseStatus()
    },
  })
)(Files)

export default SecurityPrefsHoc(ConnectedFiles)
