// @flow
import Files from './index'
import * as FsGen from '../../actions/fs-gen'
import * as Types from '../../constants/types/fs'
import {connect, compose, lifecycle, setDisplayName, type TypedState} from '../../util/container'
import {isLinux} from '../../constants/platform'

type OwnProps = {
  path?: Types.Path,
}

const mapStateToProps = (state: TypedState) => {
  const kbfsEnabled = isLinux || (state.fs.fuseStatus && state.fs.fuseStatus.kextStarted)
  return {
    kbfsEnabled,
    showBanner: state.fs.showBanner,
    inProgress: state.fs.fuseInstalling || state.fs.kbfsInstalling || state.fs.kbfsOpening,
    showSecurityPrefs: !kbfsEnabled && state.fs.kextPermissionError,
  }
}

const mapDispatchToProps = (dispatch: Dispatch) => {
  const uninstall = () => dispatch(FsGen.createUninstallKBFS())
  return {
    getFuseStatus: () => dispatch(FsGen.createFuseStatus()),
    onDismiss: () => dispatch(FsGen.createSetFlags({showBanner: false})),
    onInstall: () => dispatch(FsGen.createInstallFuse()),
    onUninstall: () => dispatch(FsGen.createUninstallKBFSConfirm({onSuccess: uninstall})),
  }
}

const mergeProps = (stateProps, dispatchProps, {path}: OwnProps) => ({
  ...stateProps,
  ...dispatchProps,
  path,
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  lifecycle({
    componentDidMount: function() {
      this.props.getFuseStatus()
    },
  }),
  setDisplayName('FilesBanner')
)(Files)
