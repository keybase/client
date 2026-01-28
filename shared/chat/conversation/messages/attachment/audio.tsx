import * as Chat from '@/stores/chat2'
import type * as T from '@/constants/types'
import * as Kb from '@/common-adapters'
import {useOrdinal} from '../ids-context'
import AudioPlayer from '@/chat/audio/audio-player'
import {useFSState} from '@/stores/fs'

const missingMessage = Chat.makeMessageAttachment()

const messageAttachmentHasProgress = (message: T.Chat.MessageAttachment) => {
  return (
    !!message.transferState &&
    message.transferState !== 'remoteUploading' &&
    message.transferState !== 'mobileSaving'
  )
}
const AudioAttachment = () => {
  const ordinal = useOrdinal()

  // TODO not message
  const message = Chat.useChatContext(s => {
    const m = s.messageMap.get(ordinal)
    return m?.type === 'attachment' ? m : missingMessage
  })
  const progressLabel = Chat.messageAttachmentTransferStateToProgressLabel(message.transferState)
  const hasProgress = messageAttachmentHasProgress(message)
  const openLocalPathInSystemFileManagerDesktop = useFSState(
    s => s.dispatch.defer.openLocalPathInSystemFileManagerDesktop
  )
  const onShowInFinder = () => {
    message.downloadPath && openLocalPathInSystemFileManagerDesktop?.(message.downloadPath)
  }
  const url = !message.submitState && message.fileURL.length > 0 ? `${message.fileURL}&contentforce=true` : ''
  const showInFinder = !!message.downloadPath && !Kb.Styles.isMobile
  return (
    <Kb.Box2 direction="horizontal" fullWidth={true} alignItems="flex-start">
      <Kb.Box2 direction="vertical" gap="xtiny">
        <Kb.Box2 direction="horizontal" fullWidth={true}>
          <AudioPlayer big={true} duration={message.audioDuration} url={url} visAmps={message.audioAmps} />
        </Kb.Box2>
        {!showInFinder && (
          <Kb.Box2 direction="horizontal" fullWidth={true} alignItems="center">
            <Kb.Text type="BodySmall" style={styles.progressLabelStyle}>
              {progressLabel || '\u00A0'}
            </Kb.Text>
            {hasProgress && <Kb.ProgressBar ratio={message.transferProgress} />}
          </Kb.Box2>
        )}
        {!!message.transferErrMsg && (
          <Kb.Box2 direction="horizontal" fullWidth={true} alignItems="center">
            <Kb.Text type="BodySmall" style={styles.error}>
              Failed to download attachment, please retry
            </Kb.Text>
          </Kb.Box2>
        )}
        {showInFinder && (
          <Kb.Text type="BodySmallPrimaryLink" onClick={onShowInFinder} style={styles.linkStyle}>
            Show in {Kb.Styles.fileUIName}
          </Kb.Text>
        )}
      </Kb.Box2>
    </Kb.Box2>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  error: {color: Kb.Styles.globalColors.redDark},
  linkStyle: {
    color: Kb.Styles.globalColors.black_50,
  },
  progressLabelStyle: {
    color: Kb.Styles.globalColors.black_50,
    marginRight: Kb.Styles.globalMargins.tiny,
  },
}))

export default AudioAttachment
