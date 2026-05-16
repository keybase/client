import * as T from '@/constants/types'
import Upload from '@/fs/footer/upload'
import {useUploadCountdown} from '@/fs/footer/use-upload-countdown'
import {useFsUploadStatus, useKbfsDaemonStatus} from '@/fs/common'
import {useNonFolderSyncingPaths} from '@/fs/common/use-non-folder-syncing-paths'

const UpoadContainer = () => {
  const kbfsDaemonStatus = useKbfsDaemonStatus()
  const uploads = useFsUploadStatus()

  // We just use syncingPaths rather than merging with writingToJournal here
  // since journal status comes a bit slower, and merging the two causes
  // flakes on our perception of overall upload status.

  // Filter out folder paths.
  const filePaths = useNonFolderSyncingPaths(uploads.syncingPaths)

  const np = useUploadCountdown({
    // We just use syncingPaths rather than merging with writingToJournal here
    // since journal status comes a bit slower, and merging the two causes
    // flakes on our perception of overall upload status.
    endEstimate: uploads.endEstimate || 0,
    fileName: filePaths.length === 1 ? T.FS.getPathName(filePaths[0] || T.FS.stringToPath('')) : undefined,
    files: filePaths.length,
    isOnline: kbfsDaemonStatus.onlineStatus !== T.FS.KbfsDaemonOnlineStatus.Offline,
    totalSyncingBytes: uploads.totalSyncingBytes,
  })

  return <Upload {...np} />
}
export default UpoadContainer
