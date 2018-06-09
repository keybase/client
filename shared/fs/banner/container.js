// @flow
import Banner from './index'
import * as FsGen from '../../actions/fs-gen'
import * as Types from '../../constants/types/fs'
import {connect, compose, lifecycle, setDisplayName, type TypedState} from '../../util/container'
import * as StateMappers from '../utils/state-mappers'
import {isMobile} from '../../constants/platform'

type OwnProps = {
  path?: Types.Path,
}

const mapStateToProps = (state: TypedState) => {
  const kbfsEnabled = StateMappers.mapStateToKBFSEnabled(state)
  return {
    kbfsEnabled,
    showBanner: state.fs.flags.showBanner,
    inProgress: state.fs.flags.fuseInstalling || state.fs.flags.kbfsInstalling || state.fs.flags.kbfsOpening,
    showSecurityPrefs: !kbfsEnabled && state.fs.flags.kextPermissionError,
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
  ...dispatchProps,
  openInFileUI: stateProps.kbfsEnabled && path ? () => dispatchProps._openInFileUI(path) : undefined,
  path,
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
