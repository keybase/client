import UnlockFolders from './index.desktop'
import {remoteConnect} from '../util/container'
import * as UnlockFoldersGen from '../actions/unlock-folders-gen'
import {DeserializeProps} from './remote-serializer.desktop'

type OwnProps = {}

// Props are handled by remote-proxy.desktop.js
export default remoteConnect(
  (state: DeserializeProps) => state,
  dispatch => ({
    onBackFromPaperKey: () => dispatch(UnlockFoldersGen.createOnBackFromPaperKey()),
    onClose: () => dispatch(UnlockFoldersGen.createClosePopup()),
    onContinueFromPaperKey: (paperKey: string) => dispatch(UnlockFoldersGen.createCheckPaperKey({paperKey})),
    onFinish: () => dispatch(UnlockFoldersGen.createFinish()),
    toPaperKeyInput: () => dispatch(UnlockFoldersGen.createToPaperKeyInput()),
  }),
  (s, d, o: OwnProps) => ({
    ...o,
    ...s,
    ...d,
  })
)(UnlockFolders)
