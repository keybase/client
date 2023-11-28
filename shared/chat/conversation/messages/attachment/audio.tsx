import * as C from '@/constants'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import {OrdinalContext} from '../ids-context'
import AudioPlayer from '@/chat/audio/audio-player'

const missingMessage = C.Chat.makeMessageAttachment()
const AudioAttachment = () => {
  const ordinal = React.useContext(OrdinalContext)

  // TODO not message
  const message = C.useChatContext(s => {
    const m = s.messageMap.get(ordinal)
    return m?.type === 'attachment' ? m : missingMessage
  })
  const progressLabel = C.Chat.messageAttachmentTransferStateToProgressLabel(message.transferState)
  const hasProgress = C.Chat.messageAttachmentHasProgress(message)
  const openLocalPathInSystemFileManagerDesktop = C.useFSState(
    s => s.dispatch.dynamic.openLocalPathInSystemFileManagerDesktop
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
