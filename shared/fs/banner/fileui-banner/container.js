// @flow
import Banner from './index'
import * as FsGen from '../../../actions/fs-gen'
import * as Types from '../../../constants/types/fs'
import * as Constants from '../../../constants/fs'
import {connect, compose, lifecycle, setDisplayName, type TypedState} from '../../../util/container'
import {isMobile} from '../../../constants/platform'

type OwnProps = {
  path?: Types.Path,
}

const mapStateToProps = (state: TypedState) => {
  const kbfsEnabled = Constants.kbfsEnabled(state)
  const kbfsOutdated = Constants.kbfsOutdated(state)
  return {
    kbfsEnabled,
    kbfsOutdated,
    showBanner: !kbfsEnabled && state.fs.flags.showBanner,
    inProgress: state.fs.flags.fuseInstalling || state.fs.flags.kbfsInstalling || state.fs.flags.kbfsOpening,
    showSecurityPrefs: !kbfsEnabled && state.fs.flags.kextPermissionError,
    dokanUninstallString: Constants.kbfsUninstallString(state),
  }
}

const mapDispatchToProps = (dispatch: Dispatch) => {
  return {
    getFuseStatus: () => dispatch(FsGen.createFuseStatus()),
    onDismiss: () => dispatch(FsGen.createSetFlags({showBanner: false})),
    onInstall: () => dispatch(FsGen.createInstallFuse()),
    onUninstall: () => dispatch(FsGen.createUninstallKBFSConfirm()),
    _openInFileUI: (path: Types.Path) => dispatch(FsGen.createOpenInFileUI({path: Types.pathToString(path)})),
  }
}

const mergeProps = (stateProps, dispatchProps, {path}: OwnProps) => ({
  ...stateProps,
  getFuseStatus: dispatchProps.getFuseStatus,
  onDismiss: dispatchProps.onDismiss,
  onInstall: dispatchProps.onInstall,
  onUninstall: dispatchProps.onUninstall,
  openInFileUI: stateProps.kbfsEnabled && path ? () => dispatchProps._openInFileUI(path) : undefined,
  path,
  dokanUninstall: stateProps.dokanUninstallString ? dispatchProps.onUninstall : undefined,
})

const ConnectedBanner = isMobile
  ? () => null
  : compose(
      connect(mapStateToProps, mapDispatchToProps, mergeProps),
      setDisplayName('FilesBanner'),
      lifecycle({
        componentDidMount() {
          this.props.getFuseStatus()
        },
      })
    )(Banner)

export default ConnectedBanner
