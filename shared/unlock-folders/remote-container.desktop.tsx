import * as Container from '../util/container'
import * as UnlockFoldersGen from '../actions/unlock-folders-gen'
import UnlockFolders from './index.desktop'
import type {DeserializeProps} from './remote-serializer.desktop'

const RemoteContainer = () => {
  const state = Container.useRemoteStore<DeserializeProps>()
  const dispatch = Container.useDispatch()

  return (
    <UnlockFolders
      {...state}
      onBackFromPaperKey={() => dispatch(UnlockFoldersGen.createOnBackFromPaperKey())}
      onClose={() => dispatch(UnlockFoldersGen.createClosePopup())}
      onContinueFromPaperKey={(paperKey: string) =>
        dispatch(UnlockFoldersGen.createCheckPaperKey({paperKey}))
      }
      onFinish={() => dispatch(UnlockFoldersGen.createFinish())}
      toPaperKeyInput={() => dispatch(UnlockFoldersGen.createToPaperKeyInput())}
    />
  )
}
export default RemoteContainer
