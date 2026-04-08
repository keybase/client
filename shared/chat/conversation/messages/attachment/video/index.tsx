import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as Chat from '@/stores/chat'
import type * as T from '@/constants/types'
import VideoImpl from './videoimpl'
import {
  Title,
  Collapsed,
  useCollapseIcon,
  Transferring,
  TransferIcon,
  ShowToastAfterSaving,
  getAttachmentDisplayFileName,
} from '../shared'
import {Keyboard} from 'react-native'

type Props = {
  message: T.Chat.MessageAttachment
  ordinal: T.Chat.Ordinal
  showPopup: () => void
}

function Video(p: Props) {
  const {message, ordinal, showPopup} = p
  const {isCollapsed, submitState, title, transferProgress, transferState} = message
  const attachmentPreviewSelect = Chat.useChatContext(s => s.dispatch.attachmentPreviewSelect)
  const fileName = getAttachmentDisplayFileName(message)
  const showTitle = !!title
  const openFullscreen = () => {
    Keyboard.dismiss()
    attachmentPreviewSelect(ordinal)
  }
  const containerStyle = styles.container
  const collapseIcon = useCollapseIcon(ordinal, isCollapsed, false)

  const filename = Kb.Styles.isMobile || !fileName ? null : (
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
        gap={Kb.Styles.isMobile ? undefined : 'small'}
        alignItems="center"
        ref={toastTargetRef}
      >
        <Kb.Box2
          direction="vertical"
        relative={true}
          style={styles.contentContainer}
          alignSelf="flex-start"
          alignItems="center"
          gap="xxtiny"
        >
          <ShowToastAfterSaving transferState={transferState} toastTargetRef={toastTargetRef} />
          <VideoImpl
            message={message}
            openFullscreen={openFullscreen}
            showPopup={showPopup}
            allowPlay={transferState !== 'uploading' && submitState !== 'pending'}
          />
          {showTitle ? <Title message={message} /> : null}
          <Transferring transferState={transferState} ratio={transferProgress} />
        </Kb.Box2>
        <TransferIcon message={message} ordinal={ordinal} style={Kb.Styles.isMobile ? styles.transferIcon : undefined} />
      </Kb.Box2>
    </>
  )

  return (
    <Kb.Box2 direction="vertical" fullWidth={true} relative={true} style={containerStyle} alignItems="flex-start">
      {isCollapsed ? <Collapsed isCollapsed={isCollapsed} ordinal={ordinal} /> : content}
    </Kb.Box2>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      container: {
        alignSelf: 'center',
        paddingRight: Kb.Styles.isMobile ? 0 : Kb.Styles.globalMargins.tiny,
      },
      contentContainer: {
        backgroundColor: Kb.Styles.globalColors.black_05_on_white,
        borderRadius: Kb.Styles.borderRadius,
        maxWidth: Kb.Styles.isMobile ? '100%' : 356 + 3 * 2,
        padding: 3,
      },
      transferIcon: {left: -32, position: 'absolute'},
    }) as const
)

export default Video
