// @flow
import * as FsGen from '../../actions/fs-gen'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import {compose, connect, setDisplayName, type TypedState, type Dispatch} from '../../util/container'
import {type OpenInFileUIProps as OwnProps} from './open-in-fileui-container'
import OpenInFileUI from './open-in-fileui.desktop'

const mapStateToProps = (state: TypedState, {path}: OwnProps) => ({
  kbfsEnabled: Constants.kbfsEnabled(state),
})

const mapDispatchToProps = (dispatch: Dispatch, {path}: OwnProps) => ({
  openInFileUI: () => dispatch(FsGen.createOpenInFileUI({path: Types.pathToString(path)})),
  installFuse: () => dispatch(FsGen.createInstallFuse()),
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps, (s, d, o) => ({...s, ...d, ...o})),
  setDisplayName('ConnectedOpenInFileUI')
)(OpenInFileUI)
