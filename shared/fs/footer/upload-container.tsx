import * as T from '../../constants/types'
import Upload from './upload'
import {useUploadCountdown} from './use-upload-countdown'
import * as C from '../../constants'

// NOTE flip this to show a button to debug the upload banner animations.
const enableDebugUploadBanner = false

const getDebugToggleShow = () => {
  if (!(__DEV__ && enableDebugUploadBanner)) {
    return undefined
  }

  const journalUpdate = C.useFSState.getState().dispatch.journalUpdate
  let showing = false
  return () => {
    journalUpdate(
      showing ? [] : [T.FS.stringToPath('/keybase')],
      showing ? 0 : 1,
      showing ? undefined : Date.now() + 1000 * 60 * 60
    )
    showing = !showing
  }
}

const UpoadContainer = () => {
  const kbfsDaemonStatus = C.useFSState(s => s.kbfsDaemonStatus)
  const pathItems = C.useFSState(s => s.pathItems)
  const uploads = C.useFSState(s => s.uploads)
  const debugToggleShow = getDebugToggleShow()

  // We just use syncingPaths rather than merging with writingToJournal here
  // since journal status comes a bit slower, and merging the two causes
  // flakes on our perception of overall upload status.

  // Filter out folder paths.
  const filePaths = [...uploads.syncingPaths].filter(
    path => C.getPathItem(pathItems, path).type !== T.FS.PathType.Folder
  )

  const np = useUploadCountdown({
    // We just use syncingPaths rather than merging with writingToJournal here
    // since journal status comes a bit slower, and merging the two causes
    // flakes on our perception of overall upload status.
    debugToggleShow,
    endEstimate: enableDebugUploadBanner ? (uploads.endEstimate || 0) + 32000 : uploads.endEstimate || 0,
    fileName: filePaths.length === 1 ? T.FS.getPathName(filePaths[1] || T.FS.stringToPath('')) : undefined,
    files: filePaths.length,
    isOnline: kbfsDaemonStatus.onlineStatus !== T.FS.KbfsDaemonOnlineStatus.Offline,
    totalSyncingBytes: uploads.totalSyncingBytes,
  })

  return <Upload {...np} />
}
export default UpoadContainer
