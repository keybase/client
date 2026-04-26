import * as Kb from '@/common-adapters'
import * as React from 'react'
import * as ConvoState from '@/stores/convostate'
import type * as T from '@/constants/types'
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
  const attachmentPreviewSelect = ConvoState.useChatContext(s => s.dispatch.attachmentPreviewSelect)
  const fileName = getAttachmentDisplayFileName(message)
  const showTitle = !!title
  const openFullscreen = () => {
    Keyboard.dismiss()
    attachmentPreviewSelect(ordinal)
  }
  const containerStyle = styles.container
  const collapseIcon = useCollapseIcon(ordinal, isCollapsed, false)

  const filename =
    Kb.Styles.isMobile || !fileName ? null : (
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
        alignItems="center"
        {...(!Kb.Styles.isMobile ? ({gap: 'small'} as const) : {})}
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
            onClick={openFullscreen}
            onLongPress={showPopup}
            style={styles.imageContainer}
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
          style={Kb.Styles.isMobile ? styles.transferIcon : undefined}
        />
      </Kb.Box2>
    </>
  )

  return (
    <Kb.Box2 direction="vertical" fullWidth={true} style={containerStyle} alignItems="flex-start">
      {isCollapsed ? <Collapsed isCollapsed={isCollapsed} ordinal={ordinal} /> : content}
    </Kb.Box2>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => {
  return {
    container: {alignSelf: 'center'},
    contentContainer: {
      backgroundColor: Kb.Styles.globalColors.black_05_on_white,
      borderRadius: Kb.Styles.borderRadius,
      maxWidth: Kb.Styles.isMobile ? '100%' : 330,
      padding: 3,
    },
    imageContainer: {alignSelf: 'center'},
    transferIcon: {left: -32, position: 'absolute'},
  } as const
})

export default Image
