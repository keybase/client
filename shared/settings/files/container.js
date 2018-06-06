// @flow
import Files from './index'
import * as FsGen from '../../actions/fs-gen'
import {connect, compose, lifecycle, type TypedState} from '../../util/container'
import * as StateMappers from '../../fs/utils/state-mappers'
import SecurityPrefsPromptingHoc from '../../fs/common/security-prefs-prompting-hoc'
import {navigateAppend} from '../../actions/route-tree'

const mapStateToProps = (state: TypedState) => {
  const kbfsEnabled = StateMappers.mapStateToKBFSEnabled(state)
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
    showSecurityPrefs: () =>
      dispatch(
        navigateAppend([
          {
            props: {},
            selected: 'securityPrefs',
          },
        ])
      ),
  }
}

const ConnectedFiles = compose(
  connect(
    mapStateToProps,
    mapDispatchToProps
  ),
  lifecycle({
    componentDidMount() {
      this.props.getFuseStatus()
    },
  })
)(Files)

export default SecurityPrefsPromptingHoc(ConnectedFiles)
