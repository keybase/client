import * as C from '@/constants'
import * as React from 'react'
import type * as T from '@/constants/types'
import * as Kb from '@/common-adapters'

const PinnedMessageContainer = React.memo(function PinnedMessageContainer() {
  const conversationIDKey = C.useChatContext(s => s.id)
  const you = C.useCurrentUserState(s => s.username)
  const teamname = C.useChatContext(s => s.meta.teamname)
  const pinnedMsg = C.useChatContext(s => s.meta.pinnedMsg)
  const replyJump = C.useChatContext(s => s.dispatch.replyJump)
  const message = pinnedMsg?.message
  const yourOperations = C.useTeamsState(s => C.Teams.getCanPerform(s, teamname))
  const unpinning = C.Waiting.useAnyWaiting(C.Chat.waitingKeyUnpin(conversationIDKey))
  const messageID = message?.id
  const onClick = React.useCallback(() => {
    messageID && replyJump(messageID)
  }, [replyJump, messageID])
  const onIgnore = C.useChatContext(s => s.dispatch.ignorePinnedMessage)
  const pinMessage = C.useChatContext(s => s.dispatch.pinMessage)
  const onUnpin = React.useCallback(() => {
    pinMessage()
  }, [pinMessage])

  const canAdminDelete = !!yourOperations.deleteOtherMessages
  const attachment: T.Chat.MessageAttachment | undefined =
    message?.type === 'attachment' && message.attachmentType === 'image' ? message : undefined
  const pinnerUsername = pinnedMsg?.pinnerUsername
  const author = message?.author
  const imageHeight = attachment ? attachment.previewHeight : undefined
  const imageURL = attachment ? attachment.previewURL : undefined
  const imageWidth = attachment ? attachment.previewWidth : undefined
  const text =
    message?.type === 'text'
      ? message.decoratedText
        ? message.decoratedText.stringValue()
        : ''
      : message?.title || message?.fileName

  const yourMessage = pinnerUsername === you
  const dismissUnpins = yourMessage || canAdminDelete
  const _onDismiss = dismissUnpins ? onUnpin : onIgnore
  const closeref = React.useRef<Kb.MeasureRef>(null)
  const [showPopup, setShowPopup] = React.useState(false)
  const onDismiss = React.useCallback(() => {
    setShowPopup(false)
    _onDismiss()
  }, [_onDismiss])

  const onIconClick = React.useCallback(() => {
    dismissUnpins ? () => setShowPopup(true) : onDismiss
  }, [dismissUnpins, onDismiss])

  if (!message || !(message.type === 'text' || message.type === 'attachment')) {
    return null
  }
  if (!text) {
    return null
  }
  const sizing = imageWidth && imageHeight ? C.Chat.zoomImage(imageWidth, imageHeight, 30) : undefined
  const pin = (
    <Kb.ClickableBox className="hover_container" onClick={onClick} style={styles.container}>
      <Kb.Box2 direction="horizontal" fullWidth={true} gap="tiny">
        <Kb.Box2 direction="horizontal" style={styles.blueBar} />
        {!!imageURL && (
          <Kb.Box2 direction="vertical" style={styles.imageContainer}>
            <Kb.Box style={{...(sizing ? sizing.margins : {})}}>
              <Kb.Image2 src={imageURL} style={{...(sizing ? sizing.dims : {})}} />
            </Kb.Box>
          </Kb.Box2>
        )}
        <Kb.Box2 direction="vertical" fullWidth={true} style={{flex: 1}}>
          <Kb.Box2 direction="horizontal" gap="tiny" fullWidth={true}>
            <Kb.Text type="BodyTinyBold" style={styles.author}>
              {author}
            </Kb.Text>
            <Kb.Text type="BodyTinySemibold" style={styles.label}>
              Pinned
            </Kb.Text>
          </Kb.Box2>
          <Kb.Markdown smallStandaloneEmoji={true} lineClamp={1} style={styles.text} serviceOnly={true}>
            {text}
          </Kb.Markdown>
        </Kb.Box2>
        {unpinning ? (
          <Kb.Box2 direction="vertical" alignSelf="center">
            <Kb.ProgressIndicator type="Small" />
          </Kb.Box2>
        ) : (
          <Kb.Icon
            onClick={onIconClick}
            type="iconfont-close"
            sizeType="Small"
            style={styles.close}
            boxStyle={styles.close}
            ref={closeref}
          />
        )}
      </Kb.Box2>
    </Kb.ClickableBox>
  )
  const popup = (
    <UnpinPrompt
      attachTo={closeref}
      onHidden={() => setShowPopup(false)}
      onUnpin={onDismiss}
      visible={showPopup}
    />
  )
  return (
    <>
      {pin}
      {popup}
    </>
  )
})

type UnpinProps = {
  attachTo?: React.RefObject<Kb.MeasureRef>
  onHidden: () => void
  onUnpin: () => void
  visible: boolean
}

const UnpinPrompt = (props: UnpinProps) => {
  const header = (
    <Kb.Box2 direction="vertical" centerChildren={true} gap="xsmall" style={styles.popup}>
      <Kb.Text type="BodyBig">Unpin this message?</Kb.Text>
      <Kb.Box2 direction="vertical" centerChildren={true}>
        <Kb.Text type="BodySmall">This will remove the pin from</Kb.Text>
        <Kb.Text type="BodySmall">everyone's view.</Kb.Text>
      </Kb.Box2>
    </Kb.Box2>
  )
  return (
    <Kb.FloatingMenu
      attachTo={props.attachTo}
      closeOnSelect={false}
      onHidden={props.onHidden}
      visible={props.visible}
      propagateOutsideClicks={true}
      header={header}
      position="left center"
      items={['Divider', {icon: 'iconfont-close', onClick: props.onUnpin, title: 'Yes, unpin'}]}
    />
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      author: {color: Kb.Styles.globalColors.black},
      blueBar: {
        alignSelf: 'stretch',
        backgroundColor: Kb.Styles.globalColors.blue,
        width: Kb.Styles.globalMargins.xtiny,
      },
      close: Kb.Styles.platformStyles({
        common: {alignSelf: 'flex-start'},
        isElectron: {
          paddingBottom: Kb.Styles.globalMargins.xtiny,
          paddingLeft: Kb.Styles.globalMargins.xtiny,
          paddingTop: Kb.Styles.globalMargins.xtiny,
        },
        isMobile: {padding: Kb.Styles.globalMargins.xtiny},
      }),
      container: {
        ...Kb.Styles.padding(Kb.Styles.globalMargins.tiny, Kb.Styles.globalMargins.xsmall),
        backgroundColor: Kb.Styles.globalColors.white,
        borderBottomWidth: 1,
        borderColor: Kb.Styles.globalColors.black_10,
        borderStyle: 'solid',
        width: '100%',
      },
      imageContainer: {
        overflow: 'hidden',
        position: 'relative',
      },
      label: {color: Kb.Styles.globalColors.blueDark},
      popup: Kb.Styles.platformStyles({
        common: {
          paddingLeft: Kb.Styles.globalMargins.small,
          paddingRight: Kb.Styles.globalMargins.small,
          paddingTop: Kb.Styles.globalMargins.small,
        },
        isElectron: {maxWidth: 200},
      }),
      styleOverride: Kb.Styles.platformStyles({
        common: {color: Kb.Styles.globalColors.black_50},
        isElectron: {transition: 'color 0.25s ease-in-out'},
      }),
      text: Kb.Styles.platformStyles({
        common: {color: Kb.Styles.globalColors.black_50},
        isElectron: {
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        } as const,
      }),
    }) as const
)

export default PinnedMessageContainer
