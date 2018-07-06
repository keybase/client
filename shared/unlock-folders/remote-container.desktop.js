// @flow
import UnlockFolders from './index.desktop'
import {connect, type Dispatch} from '../util/container'
import * as UnlockFoldersGen from '../actions/unlock-folders-gen'

// Props are handled by remote-proxy.desktop.js
const mapDispatchToProps = (dispatch: Dispatch) => ({
  onBackFromPaperKey: () => dispatch(UnlockFoldersGen.createOnBackFromPaperKey()),
  onClose: () => dispatch(UnlockFoldersGen.createClosePopup()),
  onContinueFromPaperKey: (paperKey: string) => dispatch(UnlockFoldersGen.createCheckPaperKey({paperKey})),
  onFinish: () => dispatch(UnlockFoldersGen.createFinish()),
  toPaperKeyInput: () => dispatch(UnlockFoldersGen.createToPaperKeyInput()),
})
export default connect(state => state, mapDispatchToProps)(UnlockFolders)
