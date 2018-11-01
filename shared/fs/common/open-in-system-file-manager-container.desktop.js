// @flow
import * as FsGen from '../../actions/fs-gen'
import * as Constants from '../../constants/fs'
import {namedConnect} from '../../util/container'
import {type OpenInSystemFileManagerProps as OwnProps} from './open-in-system-file-manager-container'
import OpenInSystemFileManager from './open-in-system-file-manager.desktop'

const mapStateToProps = (state, {path}: OwnProps) => ({
  kbfsEnabled: Constants.kbfsEnabled(state),
})

const mapDispatchToProps = (dispatch, {path}: OwnProps) => ({
  openInSystemFileManager: () => dispatch(FsGen.createOpenPathInSystemFileManager({path})),
  installFuse: () => dispatch(FsGen.createInstallFuse()),
})

export default namedConnect(
  mapStateToProps,
  mapDispatchToProps,
  (s, d, o) => ({...o, ...s, ...d}),
  'ConnectedOpenInSystemFileManager'
)(OpenInSystemFileManager)
