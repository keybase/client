import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import {useColorScheme, Image} from 'react-native'
import Upload from './upload'
import {useUploadCountdown} from './use-upload-countdown'
import {useFsUploadStatus, useKbfsDaemonStatus} from '../common'
import {useNonFolderSyncingPaths} from '../common/use-non-folder-syncing-paths'

const lightPatternImage = require('../../images/upload-pattern-80.png') as number
const darkPatternImage = require('../../images/dark-upload-pattern-80.png') as number

const UploadAccessory = () => {
  const kbfsDaemonStatus = useKbfsDaemonStatus()
  const uploads = useFsUploadStatus()
  const filePaths = useNonFolderSyncingPaths(uploads.syncingPaths)
  const {files, timeLeft, totalSyncingBytes} = useUploadCountdown({
    endEstimate: uploads.endEstimate || 0,
    fileName:
      filePaths.length === 1 ? T.FS.getPathName(filePaths[0] || T.FS.stringToPath('')) : undefined,
    files: filePaths.length,
    isOnline: kbfsDaemonStatus.onlineStatus !== T.FS.KbfsDaemonOnlineStatus.Offline,
    totalSyncingBytes: uploads.totalSyncingBytes,
  })
  const isDarkMode = useColorScheme() === 'dark'
  return (
    <>
      <Kb.Box2 direction="vertical" fullWidth={true} style={styles.accessoryBg}>
        <Image
          resizeMode="repeat"
          source={isDarkMode ? darkPatternImage : lightPatternImage}
          style={styles.accessoryBgImage}
        />
      </Kb.Box2>
      <Kb.Box2 direction="vertical" centerChildren={true} fullWidth={true} style={styles.accessoryText}>
        <Kb.Text type="BodySmallSemibold" style={styles.text}>
          {files
            ? `Encrypting and uploading ${files} files...`
            : totalSyncingBytes
              ? 'Encrypting and uploading...'
              : 'Done!'}
        </Kb.Text>
        {!!timeLeft.length && (
          <Kb.Text type="BodyTiny" style={styles.text}>{`${timeLeft} left`}</Kb.Text>
        )}
      </Kb.Box2>
    </>
  )
}

const UploadContainer = () => {
  const kbfsDaemonStatus = useKbfsDaemonStatus()
  const uploads = useFsUploadStatus()
  const filePaths = useNonFolderSyncingPaths(uploads.syncingPaths)
  const np = useUploadCountdown({
    endEstimate: uploads.endEstimate || 0,
    fileName:
      filePaths.length === 1 ? T.FS.getPathName(filePaths[0] || T.FS.stringToPath('')) : undefined,
    files: filePaths.length,
    isOnline: kbfsDaemonStatus.onlineStatus !== T.FS.KbfsDaemonOnlineStatus.Offline,
    totalSyncingBytes: uploads.totalSyncingBytes,
  })

  if (np.showing) {
    return <Kb.BottomAccessory><UploadAccessory /></Kb.BottomAccessory>
  }
  return <Upload {...np} />
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  accessoryBg: {
    height: 48,
    overflow: 'hidden',
  },
  accessoryBgImage: {
    height: 160,
    width: '100%',
  },
  accessoryText: {
    height: 48,
    marginTop: -48,
  },
  text: {
    color: Kb.Styles.globalColors.whiteOrWhite,
  },
}))

export default UploadContainer
