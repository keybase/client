// @flow
import * as FsGen from '../../actions/fs-gen'
import * as Constants from '../../constants/fs'
import {compose, connect, setDisplayName, type TypedState} from '../../util/container'
import {type OpenInSystemFileManagerProps as OwnProps} from './open-in-system-file-manager-container'
import OpenInSystemFileManager from './open-in-system-file-manager.desktop'

const mapStateToProps = (state: TypedState, {path}: OwnProps) => ({
  kbfsEnabled: Constants.kbfsEnabled(state),
})

const mapDispatchToProps = (dispatch, {path}: OwnProps) => ({
  openInSystemFileManager: () => dispatch(FsGen.createOpenPathInSystemFileManager({path})),
  installFuse: () => dispatch(FsGen.createInstallFuse()),
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps, (s, d, o) => ({...o, ...s, ...d})),
  setDisplayName('ConnectedOpenInSystemFileManager')
)(OpenInSystemFileManager)
