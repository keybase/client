import * as Kb from '@/common-adapters'
import * as React from 'react'
import * as T from '@/constants/types'
import {showAttachmentPreview} from '../../../attachment-actions'
import {useConversationThreadID} from '../../../thread-context'
import ImageImpl from './imageimpl'
import {
  getAttachmentDisplayFileName,
  ShowToastAfterSaving,
  Title,
  useCollapseIcon,
  Collapsed,
  Transferring,
  TransferIcon,
} from '../shared'
import {Keyboard} from 'react-native'

type Props = {
  message: T.Chat.MessageAttachment
  ordinal: T.Chat.Ordinal
  showPopup: () => void
}

function Image(p: Props) {
  const {message, ordinal, showPopup} = p
  const {isCollapsed, title, transferProgress, transferState} = message
  const conversationIDKey = useConversationThreadID()
  const hasMessageID = !!T.Chat.messageIDToNumber(message.id)
  const fileName = getAttachmentDisplayFileName(message)
  const showTitle = !!title
  const openFullscreen = hasMessageID
    ? () => {
        Keyboard.dismiss()
        showAttachmentPreview(conversationIDKey, message)
      }
    : undefined
  const collapseIcon = useCollapseIcon(ordinal, isCollapsed, false)

  const filename =
    isMobile || !fileName ? null : (
      <Kb.Box2 direction="horizontal" alignSelf="flex-start" gap="xtiny">
        <Kb.Text type="BodySmall">{fileName}</Kb.Text>
        {collapseIcon}
      </Kb.Box2>
    )

  const toastTargetRef = React.useRef<Kb.MeasureRef | null>(null)

  const content = (
    <>
      {filename}
      <Kb.Box2
        direction="horizontal"
        alignSelf="flex-start"
        gap={isMobile ? undefined : 'small'}
        alignItems="center"
      >
        <Kb.Box2
          direction="vertical"
          relative={true}
          style={styles.contentContainer}
          alignSelf="flex-start"
          alignItems="flex-start"
          gap="xxtiny"
        >
          <ShowToastAfterSaving transferState={transferState} toastTargetRef={toastTargetRef} />
          <Kb.ClickableBox
            direction="vertical"
            alignSelf="center"
            onClick={openFullscreen}
            onLongPress={hasMessageID ? showPopup : undefined}
            ref={toastTargetRef}
          >
            <ImageImpl message={message} />
          </Kb.ClickableBox>
          {showTitle ? <Title message={message} /> : null}
          <Transferring transferState={transferState} ratio={transferProgress} />
        </Kb.Box2>
        <TransferIcon
          message={message}
          ordinal={ordinal}
          style={isMobile ? styles.transferIcon : undefined}
        />
      </Kb.Box2>
    </>
  )

  return (
    <Kb.Box2 direction="vertical" fullWidth={true} alignSelf="center" alignItems="flex-start">
      {isCollapsed ? <Collapsed isCollapsed={isCollapsed} ordinal={ordinal} /> : content}
    </Kb.Box2>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => {
  return {
    contentContainer: {
      backgroundColor: Kb.Styles.globalColors.black_05_on_white,
      borderRadius: Kb.Styles.borderRadius,
      maxWidth: isMobile ? '100%' : 330,
      padding: 3,
    },
    transferIcon: {left: -32, position: 'absolute'},
  } as const
})

export default Image
