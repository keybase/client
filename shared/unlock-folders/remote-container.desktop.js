// @flow
import UnlockFolders from './index.desktop'
import {connect, type Dispatch} from '../util/container'
import * as UnlockFoldersGen from '../actions/unlock-folders-gen'

// Props are handled by remote-pgp.desktop.js
const mapStateToProps = state => state
const mapDispatchToProps = (dispatch: Dispatch) => ({
  close: () => dispatch(UnlockFoldersGen.createClosePopup()),
  onBackFromPaperKey: () => dispatch(UnlockFoldersGen.createOnBackFromPaperKey()),
  onContinueFromPaperKey: (paperKey: string) => dispatch(UnlockFoldersGen.createCheckPaperKey({paperKey})),
  onFinish: () => dispatch(UnlockFoldersGen.createFinish()),
  toPaperKeyInput: () => dispatch(UnlockFoldersGen.createToPaperKeyInput()),
})
export default connect(mapStateToProps, mapDispatchToProps)(UnlockFolders)
