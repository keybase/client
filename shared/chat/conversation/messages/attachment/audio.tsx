import * as Chat from '@/constants/chat'
import type * as T from '@/constants/types'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import AudioPlayer from '@/chat/audio/audio-player'
import {Title, TransferIcon, ShowToastAfterSaving, messageAttachmentHasProgress} from './shared'

const AudioAttachment = ({message, ordinal}: {message: T.Chat.MessageAttachment; ordinal: T.Chat.Ordinal}) => {
  const progressLabel = Chat.messageAttachmentTransferStateToProgressLabel(message.transferState)
  const hasProgress = messageAttachmentHasProgress(message.transferState)
  const url = !message.submitState && message.fileURL.length > 0 ? `${message.fileURL}&contentforce=true` : ''
  const showTitle = !!(message.decoratedText?.stringValue() ?? message.title)

  const toastTargetRef = React.useRef<Kb.MeasureRef | null>(null)

  return (
    <Kb.Box2 direction="vertical" fullWidth={true} alignItems="flex-start">
      <ShowToastAfterSaving transferState={message.transferState} toastTargetRef={toastTargetRef} />
      <Kb.Box2
        direction="horizontal"
        alignSelf="flex-start"
        alignItems="center"
        gap={Kb.Styles.isMobile ? undefined : 'small'}
        ref={toastTargetRef}
      >
        <AudioPlayer big={true} duration={message.audioDuration} url={url} visAmps={message.audioAmps} />
        <TransferIcon
          message={message}
          ordinal={ordinal}
          style={Kb.Styles.isMobile ? styles.transferIcon : undefined}
        />
      </Kb.Box2>
      {showTitle ? <Title message={message} /> : null}
      {progressLabel || hasProgress ? (
        <Kb.Box2 direction="horizontal" fullWidth={true} alignItems="center">
          {progressLabel ? (
            <Kb.Text type="BodySmall" style={styles.progressLabelStyle}>
              {progressLabel}
            </Kb.Text>
          ) : null}
          {hasProgress && <Kb.ProgressBar ratio={message.transferProgress} />}
        </Kb.Box2>
      ) : null}
      {!!message.transferErrMsg && (
        <Kb.Box2 direction="horizontal" fullWidth={true} alignItems="center">
          <Kb.Text type="BodySmall" style={styles.error}>
            Failed to download attachment, please retry
          </Kb.Text>
        </Kb.Box2>
      )}
    </Kb.Box2>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  error: {color: Kb.Styles.globalColors.redDark},
  progressLabelStyle: {
    color: Kb.Styles.globalColors.black_50,
    marginRight: Kb.Styles.globalMargins.tiny,
  },
  transferIcon: {left: -32, position: 'absolute' as const},
}))

export default AudioAttachment
