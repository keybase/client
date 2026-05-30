import * as T from '@/constants/types'
import Upload from './upload'
import {useUploadCountdown} from './use-upload-countdown'
import {useFsUploadStatus, useKbfsDaemonStatus} from '../common'
import {useNonFolderSyncingPaths} from '../common/use-non-folder-syncing-paths'

const UploadContainer = () => {
  const kbfsDaemonStatus = useKbfsDaemonStatus()
  const uploads = useFsUploadStatus()

  // Filter out folder paths.
  const filePaths = useNonFolderSyncingPaths(uploads.syncingPaths)

  const np = useUploadCountdown({
    endEstimate: uploads.endEstimate || 0,
    fileName: filePaths.length === 1 ? T.FS.getPathName(filePaths[0] || T.FS.stringToPath('')) : undefined,
    files: filePaths.length,
    isOnline: kbfsDaemonStatus.onlineStatus !== T.FS.KbfsDaemonOnlineStatus.Offline,
    totalSyncingBytes: uploads.totalSyncingBytes,
  })

  return <Upload {...np} />
}
export default UploadContainer
