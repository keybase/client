// @flow
import Banner from './index'
import * as FsGen from '../../../actions/fs-gen'
import * as Types from '../../../constants/types/fs'
import * as Constants from '../../../constants/fs'
import {namedConnect, compose, lifecycle} from '../../../util/container'
import {isMobile} from '../../../constants/platform'

type OwnProps = {
  path?: Types.Path,
}

const mapStateToProps = state => {
  const kbfsEnabled = Constants.kbfsEnabled(state)
  const kbfsOutdated = Constants.kbfsOutdated(state)
  return {
    dokanUninstallString: Constants.kbfsUninstallString(state),
    inProgress: state.fs.flags.fuseInstalling || state.fs.flags.kbfsInstalling || state.fs.flags.kbfsOpening,
    kbfsEnabled,
    kbfsOutdated,
    showBanner: !kbfsEnabled && state.fs.flags.showBanner,
    showSecurityPrefs: !kbfsEnabled && state.fs.flags.kextPermissionError,
  }
}

const mapDispatchToProps = (dispatch, {path}: OwnProps) => {
  return {
    _openInSystemFileManager: path && (() => dispatch(FsGen.createOpenPathInSystemFileManager({path}))),
    getFuseStatus: () => dispatch(FsGen.createFuseStatus()),
    onDismiss: () => dispatch(FsGen.createSetFlags({showBanner: false})),
    onInstall: () => dispatch(FsGen.createInstallFuse()),
    onUninstall: () => dispatch(FsGen.createUninstallKBFSConfirm()),
  }
}

const mergeProps = (stateProps, dispatchProps, {path}: OwnProps) => ({
  ...stateProps,
  dokanUninstall: stateProps.dokanUninstallString ? dispatchProps.onUninstall : undefined,
  getFuseStatus: dispatchProps.getFuseStatus,
  onDismiss: dispatchProps.onDismiss,
  onInstall: dispatchProps.onInstall,
  onUninstall: dispatchProps.onUninstall,
  openInSystemFileManager:
    stateProps.kbfsEnabled && path ? () => dispatchProps._openInSystemFileManager : undefined,
  path,
})

const ConnectedBanner = isMobile
  ? () => null
  : compose(
      namedConnect<OwnProps, _, _, _, _>(mapStateToProps, mapDispatchToProps, mergeProps, 'FilesBanner'),
      lifecycle({
        componentDidMount() {
          this.props.getFuseStatus()
        },
      })
    )(Banner)

export default ConnectedBanner
