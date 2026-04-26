import * as T from '@/constants/types'
import Upload from './upload'
import {useUploadCountdown} from './use-upload-countdown'
import * as C from '@/constants'
import {useFSState} from '@/stores/fs'
import {useNonFolderSyncingPaths} from '../common/use-non-folder-syncing-paths'

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
  const {kbfsDaemonStatus, uploads} = useFSState(
    C.useShallow(s => {
      const {kbfsDaemonStatus, uploads} = s
      return {kbfsDaemonStatus, uploads}
    })
  )
  const debugToggleShow = getDebugToggleShow()

  // We just use syncingPaths rather than merging with writingToJournal here
  // since journal status comes a bit slower, and merging the two causes
  // flakes on our perception of overall upload status.

  // Filter out folder paths.
  const filePaths = useNonFolderSyncingPaths(uploads.syncingPaths)
  const fileName = filePaths.length === 1 ? T.FS.getPathName(filePaths[0] || T.FS.stringToPath('')) : undefined

  const np = useUploadCountdown({
    // We just use syncingPaths rather than merging with writingToJournal here
    // since journal status comes a bit slower, and merging the two causes
    // flakes on our perception of overall upload status.
    endEstimate: enableDebugUploadBanner ? (uploads.endEstimate || 0) + 32000 : uploads.endEstimate || 0,
    files: filePaths.length,
    isOnline: kbfsDaemonStatus.onlineStatus !== T.FS.KbfsDaemonOnlineStatus.Offline,
    totalSyncingBytes: uploads.totalSyncingBytes,
    ...(debugToggleShow === undefined ? {} : {debugToggleShow}),
    ...(fileName === undefined ? {} : {fileName}),
  })
  const {
    debugToggleShow: uploadDebugToggleShow,
    fileName: uploadFileName,
    smallMode,
    ...uploadProps
  } = np

  return (
    <Upload
      {...uploadProps}
      {...(uploadDebugToggleShow === undefined ? {} : {debugToggleShow: uploadDebugToggleShow})}
      {...(uploadFileName === undefined ? {} : {fileName: uploadFileName})}
      {...(smallMode === undefined ? {} : {smallMode})}
    />
  )
}
export default UpoadContainer
