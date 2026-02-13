import * as Chat from '@/stores/chat2'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'

const ReplyPreview = () => {
  const rordinal = Chat.useChatContext(s => s.replyTo)
  const message = Chat.useChatContext(s => {
    return rordinal ? s.messageMap.get(rordinal) : null
  })
  let text = ''
  if (message) {
    switch (message.type) {
      case 'text':
        text = message.text.stringValue()
        break
      case 'attachment':
        text = message.title || (message.attachmentType === 'image' ? '' : message.fileName)
        break
      default:
    }
  }
  let attachment: T.Chat.MessageAttachment | undefined
  if (message?.type === 'attachment') {
    if (message.attachmentType === 'image') {
      attachment = message
    }
  }
  const imageHeight = attachment?.previewHeight
  const imageURL = attachment?.previewURL
  const imageWidth = attachment?.previewWidth
  const username = message?.author ?? ''
  const sizing = imageWidth && imageHeight ? Chat.zoomImage(imageWidth, imageHeight, 80) : null
  const setReplyTo = Chat.useChatContext(s => s.dispatch.setReplyTo)
  const onCancel = React.useCallback(() => {
    setReplyTo(T.Chat.numberToOrdinal(0))
  }, [setReplyTo])

  return (
    <Kb.Box style={styles.outerContainer}>
      <Kb.Box2 direction="vertical" style={styles.container} gap="xtiny" fullWidth={true}>
        <Kb.Box2 direction="vertical" style={styles.title} fullWidth={true}>
          <Kb.Text type="BodySmallSemibold">Replying to:</Kb.Text>
        </Kb.Box2>
        <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.replyContainer}>
          <Kb.Box2 direction="vertical" fullWidth={true} style={styles.contentContainer} gap="tiny">
            <Kb.Box2 direction="horizontal" gap="xtiny" fullWidth={true}>
              <Kb.Avatar username={username} size={32} />
              <Kb.Text type="BodyBold" style={styles.username}>
                {username}
              </Kb.Text>
            </Kb.Box2>
            <Kb.Box2 direction="horizontal" fullWidth={true} gap="tiny">
              {!!imageURL && (
                <Kb.Box2 direction="vertical" style={styles.replyImageContainer}>
                  <Kb.Box style={{...(sizing ? sizing.margins : {})}}>
                    <Kb.Image2 src={imageURL} style={{...(sizing ? sizing.dims : {})}} />
                  </Kb.Box>
                </Kb.Box2>
              )}
              <Kb.Text type="BodySmall" style={styles.text} lineClamp={1}>
                {text}
              </Kb.Text>
            </Kb.Box2>
          </Kb.Box2>
          <Kb.Icon onClick={onCancel} type="iconfont-remove" style={styles.close} boxStyle={styles.close} />
        </Kb.Box2>
      </Kb.Box2>
    </Kb.Box>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      close: {alignSelf: 'flex-start'},
      container: Kb.Styles.platformStyles({
        isElectron: {
          ...Kb.Styles.desktopStyles.boxShadow,
          borderRadius: Kb.Styles.borderRadius,
        },
      }),
      contentContainer: Kb.Styles.platformStyles({
        isMobile: {flex: 1},
      }),
      outerContainer: Kb.Styles.platformStyles({
        isElectron: {
          marginBottom: Kb.Styles.globalMargins.xtiny,
          marginLeft: Kb.Styles.globalMargins.small,
          marginRight: Kb.Styles.globalMargins.small,
          position: 'relative',
        },
      }),
      replyContainer: {
        justifyContent: 'space-between',
        padding: Kb.Styles.globalMargins.tiny,
      },
      replyImageContainer: {
        overflow: 'hidden',
        position: 'relative',
      },
      text: Kb.Styles.platformStyles({
        isElectron: {
          contain: 'strict',
          display: 'inline',
          flex: 1,
          height: 20,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        },
        isMobile: {flex: 1},
      }),
      title: {
        backgroundColor: Kb.Styles.globalColors.blueGrey,
        paddingBottom: Kb.Styles.globalMargins.tiny,
        paddingLeft: Kb.Styles.globalMargins.xsmall,
        paddingRight: Kb.Styles.globalMargins.xsmall,
        paddingTop: Kb.Styles.globalMargins.tiny,
      },
      username: {alignSelf: 'center'},
    }) as const
)

export default ReplyPreview
