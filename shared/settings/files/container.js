// @flow
import Files from './index'
import * as FsGen from '../../actions/fs-gen'
import * as Constants from '../../constants/fs'
import {connect, compose, lifecycle, type TypedState} from '../../util/container'
import SecurityPrefsPromptingHoc from '../../fs/common/security-prefs-prompting-hoc'
import {navigateAppend} from '../../actions/route-tree'

const mapStateToProps = (state: TypedState) => {
  const kbfsEnabled = Constants.kbfsEnabled(state)
  return {
    kbfsEnabled,
    inProgress: state.fs.flags.fuseInstalling || state.fs.flags.kbfsInstalling || state.fs.flags.kbfsOpening,
    showSecurityPrefsLink: !kbfsEnabled && state.fs.flags.kextPermissionError,
  }
}

const mapDispatchToProps = (dispatch: Dispatch) => {
  return {
    getFuseStatus: () => dispatch(FsGen.createFuseStatus()),
    onInstall: () => dispatch(FsGen.createInstallFuse()),
    onUninstall: () => dispatch(FsGen.createUninstallKBFSConfirm()),
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
  connect(mapStateToProps, mapDispatchToProps),
  lifecycle({
    componentDidMount() {
      this.props.getFuseStatus()
    },
  })
)(Files)

export default SecurityPrefsPromptingHoc(ConnectedFiles)
