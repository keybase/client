// @flow
import UnlockFolders from './index.desktop'
import {remoteConnect} from '../util/container'
import * as UnlockFoldersGen from '../actions/unlock-folders-gen'

// TODO
type State = any
type OwnProps = any

// Props are handled by remote-proxy.desktop.js
const mapDispatchToProps = dispatch => ({
  onBackFromPaperKey: () => dispatch(UnlockFoldersGen.createOnBackFromPaperKey()),
  onClose: () => dispatch(UnlockFoldersGen.createClosePopup()),
  onContinueFromPaperKey: (paperKey: string) => dispatch(UnlockFoldersGen.createCheckPaperKey({paperKey})),
  onFinish: () => dispatch(UnlockFoldersGen.createFinish()),
  toPaperKeyInput: () => dispatch(UnlockFoldersGen.createToPaperKeyInput()),
})
export default remoteConnect<OwnProps, State, _, _, _, _>(
  (state: any) => state,
  mapDispatchToProps,
  (s, d, o) => ({...o, ...s, ...d})
)(UnlockFolders)
