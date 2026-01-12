import * as C from '@/constants'
import * as Chat from '@/stores/chat2'
import * as React from 'react'
import * as Teams from '@/stores/teams'
import type * as T from '@/constants/types'
import * as Kb from '@/common-adapters'
import {useCurrentUserState} from '@/stores/current-user'

const PinnedMessage = React.memo(function PinnedMessage() {
  const {conversationIDKey, teamname, pinnedMsg, replyJump, onIgnore, pinMessage} = Chat.useChatContext(
    C.useShallow(s => {
      const {meta, dispatch, id: conversationIDKey} = s
      const teamname = meta.teamname
      const pinnedMsg = meta.pinnedMsg
      const {pinMessage, replyJump, ignorePinnedMessage: onIgnore} = dispatch
      return {conversationIDKey, onIgnore, pinMessage, pinnedMsg, replyJump, teamname}
    })
  )
  const you = useCurrentUserState(s => s.username)
  const yourOperations = Teams.useTeamsState(s => Teams.getCanPerform(s, teamname))
  const unpinning = C.Waiting.useAnyWaiting(C.waitingKeyChatUnpin(conversationIDKey))
  const {message, pinnerUsername} = pinnedMsg ?? {}
  const {id: messageID, author, type} = message ?? {}
  const canAdminDelete = !!yourOperations.deleteOtherMessages
  const attachment: T.Chat.MessageAttachment | undefined =
    message?.type === 'attachment' && message.attachmentType === 'image' ? message : undefined
  const {previewHeight: imageHeight, previewURL: imageURL, previewWidth: imageWidth} = attachment ?? {}
  const text =
    type === 'text' ? (message?.decoratedText?.stringValue() ?? '') : message?.title || message?.fileName

  const yourMessage = pinnerUsername === you
  const dismissUnpins = yourMessage || canAdminDelete

  const onClick = React.useCallback(() => {
    messageID && replyJump(messageID)
  }, [replyJump, messageID])
  const onUnpin = React.useCallback(() => {
    pinMessage()
  }, [pinMessage])
  const closeref = React.useRef<Kb.MeasureRef | null>(null)
  const [showPopup, setShowPopup] = React.useState(false)
  const _onDismiss = dismissUnpins ? onUnpin : onIgnore
  const onDismiss = React.useCallback(() => {
    setShowPopup(false)
    _onDismiss()
  }, [_onDismiss])

  const onIconClick = React.useCallback(() => {
    if (dismissUnpins) {
      setShowPopup(true)
    } else {
      onDismiss()
    }
  }, [dismissUnpins, onDismiss])

  if (!(type === 'text' || type === 'attachment')) {
    return null
  }
  if (!text) {
    return null
  }
  const sizing = imageWidth && imageHeight ? Chat.zoomImage(imageWidth, imageHeight, 30) : undefined
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
  attachTo?: React.RefObject<Kb.MeasureRef | null>
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
        <Kb.Text type="BodySmall">{"everyone's view."}</Kb.Text>
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

export default PinnedMessage
