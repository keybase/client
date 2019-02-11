// @flow
import Files from './index'
import * as FsGen from '../../actions/fs-gen'
import * as Constants from '../../constants/fs'
import {connect, compose, lifecycle} from '../../util/container'
import SecurityPrefsPromptingHoc from '../../fs/common/security-prefs-prompting-hoc'
import * as RouteTreeGen from '../../actions/route-tree-gen'

type OwnProps = {|
  shouldPromptSecurityPrefs: boolean,
  showSecurityPrefsOnce: () => void,
|}
const mapStateToProps = state => {
  const kbfsEnabled = Constants.kbfsEnabled(state)
  return {
    inProgress: state.fs.flags.fuseInstalling || state.fs.flags.kbfsInstalling || state.fs.flags.kbfsOpening,
    kbfsEnabled,
    showSecurityPrefsLink: !kbfsEnabled && state.fs.flags.kextPermissionError,
  }
}

const mapDispatchToProps = dispatch => {
  return {
    getFuseStatus: () => dispatch(FsGen.createFuseStatus()),
    onInstall: () => dispatch(FsGen.createInstallFuse()),
    onUninstall: () => dispatch(FsGen.createUninstallKBFSConfirm()),
    showSecurityPrefs: () =>
      dispatch(
        RouteTreeGen.createNavigateAppend({
          path: [
            {
              props: {},
              selected: 'securityPrefs',
            },
          ],
        })
      ),
  }
}

const ConnectedFiles = compose(
  connect<OwnProps, _, _, _, _>(
    mapStateToProps,
    mapDispatchToProps,
    (s, d, o) => ({...o, ...s, ...d})
  ),
  lifecycle({
    componentDidMount() {
      this.props.getFuseStatus()
    },
  })
)(Files)

export default SecurityPrefsPromptingHoc<OwnProps>(ConnectedFiles)
