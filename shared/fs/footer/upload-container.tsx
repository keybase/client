import * as FsGen from '../../actions/fs-gen'
import * as Types from '../../constants/types/fs'
import * as Container from '../../util/container'
import Upload from './upload'
import {useUploadCountdown} from './use-upload-countdown'
import * as Constants from '../../constants/fs'

// NOTE flip this to show a button to debug the upload banner animations.
const enableDebugUploadBanner = false

const getDebugToggleShow = dispatch => {
  if (!(__DEV__ && enableDebugUploadBanner)) {
    return undefined
  }

  let showing = false
  return () => {
    dispatch(
      FsGen.createJournalUpdate({
        endEstimate: showing ? null : Date.now() + 1000 * 60 * 60,
        syncingPaths: showing ? [] : [Types.stringToPath('/keybase')],
        totalSyncingBytes: showing ? 0 : 1,
      })
    )
    showing = !showing
  }
}

const UpoadContainer = () => {
  const kbfsDaemonStatus = Container.useSelector(state => state.fs.kbfsDaemonStatus)
  const pathItems = Container.useSelector(state => state.fs.pathItems)
  const uploads = Container.useSelector(state => state.fs.uploads)
  const dispatch = Container.useDispatch()
  const debugToggleShow = getDebugToggleShow(dispatch)

  // We just use syncingPaths rather than merging with writingToJournal here
  // since journal status comes a bit slower, and merging the two causes
  // flakes on our perception of overall upload status.

  // Filter out folder paths.
  const filePaths = [...uploads.syncingPaths].filter(
    path => Constants.getPathItem(pathItems, path).type !== Types.PathType.Folder
  )

  const np = useUploadCountdown({
    // We just use syncingPaths rather than merging with writingToJournal here
    // since journal status comes a bit slower, and merging the two causes
    // flakes on our perception of overall upload status.
    debugToggleShow,
    endEstimate: enableDebugUploadBanner ? (uploads.endEstimate || 0) + 32000 : uploads.endEstimate || 0,
    fileName: filePaths.length === 1 ? Types.getPathName(filePaths[1] || Types.stringToPath('')) : null,
    files: filePaths.length,
    isOnline: kbfsDaemonStatus.onlineStatus !== Types.KbfsDaemonOnlineStatus.Offline,
    totalSyncingBytes: uploads.totalSyncingBytes,
  })

  return <Upload {...np} />
}
export default UpoadContainer
