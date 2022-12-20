import * as Types from '../../../constants/types/fs'
import * as Constants from '../../../constants/fs'
import * as Container from '../../../util/container'
import * as FsGen from '../../../actions/fs-gen'
import {useOpen} from '../../common/use-open'
import Still from './still'

type OwnProps = {
  destinationPickerIndex?: number
  path: Types.Path
}

const StillContainer = (p: OwnProps) => {
  const {destinationPickerIndex, path} = p
  const _downloads = Container.useSelector(state => state.fs.downloads)
  const _pathItem = Container.useSelector(state => Constants.getPathItem(state.fs.pathItems, path))
  const _pathItemActionMenu = Container.useSelector(state => state.fs.pathItemActionMenu)
  const _uploads = Container.useSelector(state => state.fs.uploads)

  const dispatch = Container.useDispatch()

  const dismissUploadError = (uploadID: string) => dispatch(FsGen.createDismissUpload({uploadID}))
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
