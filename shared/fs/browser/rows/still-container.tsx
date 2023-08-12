import * as C from '../../../constants'
import * as Constants from '../../../constants/fs'
import * as Types from '../../../constants/types/fs'
import {useOpen} from '../../common/use-open'
import Still from './still'

type OwnProps = {
  destinationPickerIndex?: number
  path: Types.Path
}

const StillContainer = (p: OwnProps) => {
  const {destinationPickerIndex, path} = p
  const _downloads = C.useFSState(s => s.downloads)
  const _pathItem = C.useFSState(s => C.getPathItem(s.pathItems, path))
  const _pathItemActionMenu = C.useFSState(s => s.pathItemActionMenu)
  const _uploads = C.useFSState(s => s.uploads)

  const dismissUpload = C.useFSState(s => s.dispatch.dismissUpload)
  const dismissUploadError = dismissUpload
  const writingToJournalUploadState = _uploads.writingToJournal.get(path)
  const onOpen = useOpen({destinationPickerIndex, path})
  const np = {
    destinationPickerIndex, // needed by OpenHOC
    dismissUploadError: writingToJournalUploadState?.error
      ? () => dismissUploadError(writingToJournalUploadState.uploadID)
      : undefined,
    intentIfDownloading: Constants.getDownloadIntent(path, _downloads, _pathItemActionMenu),
    isEmpty:
      _pathItem.type === Types.PathType.Folder &&
      _pathItem.progress === Types.ProgressType.Loaded &&
      !_pathItem.children.size,
    onOpen,
    path,
    type: _pathItem.type,
    uploading: _uploads.syncingPaths.has(path),
    writingToJournal: !!writingToJournalUploadState,
  }
  return <Still {...np} />
}
export default StillContainer
