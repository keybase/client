import * as T from '@/constants/types'
import Upload from './upload'
import {useUploadCountdown} from './use-upload-countdown'
import * as C from '@/constants'
import * as FS from '@/stores/fs'
import {useFSState} from '@/stores/fs'

// NOTE flip this to show a button to debug the upload banner animations.
const enableDebugUploadBanner = false as boolean

const getDebugToggleShow = () => {
  if (!(__DEV__ && enableDebugUploadBanner)) {
    return undefined
  }

  const journalUpdate = useFSState.getState().dispatch.journalUpdate
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
  const {kbfsDaemonStatus, pathItems, uploads} = useFSState(
    C.useShallow(s => {
      const {kbfsDaemonStatus, pathItems, uploads} = s
      return {kbfsDaemonStatus, pathItems, uploads}
    })
  )
  const debugToggleShow = getDebugToggleShow()

  // We just use syncingPaths rather than merging with writingToJournal here
  // since journal status comes a bit slower, and merging the two causes
  // flakes on our perception of overall upload status.

  // Filter out folder paths.
  const filePaths = [...uploads.syncingPaths].filter(
    path => FS.getPathItem(pathItems, path).type !== T.FS.PathType.Folder
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
