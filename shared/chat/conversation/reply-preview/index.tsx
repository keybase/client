import * as React from 'react'
import * as Chat2Gen from '../../../actions/chat2-gen'
import * as Constants from '../../../constants/chat2'
import * as Container from '../../../util/container'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import type * as Types from '../../../constants/types/chat2'

type Props = {conversationIDKey: Types.ConversationIDKey}

const ReplyPreview = (props: Props) => {
  const {conversationIDKey} = props
  const message = Container.useSelector(state => {
    const ordinal = Constants.getReplyToOrdinal(state, conversationIDKey)
    return ordinal ? Constants.getMessage(state, conversationIDKey, ordinal) : null
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
  let attachment: Types.MessageAttachment | undefined
  if (message && message.type === 'attachment') {
    if (message.attachmentType === 'image') {
      attachment = message
    }
  }
  const imageHeight = attachment?.previewHeight
  const imageURL = attachment?.previewURL
  const imageWidth = attachment?.previewWidth
  const username = message?.author ?? ''

  const sizing = imageWidth && imageHeight ? Constants.zoomImage(imageWidth, imageHeight, 80) : null

  const dispatch = Container.useDispatch()
  const onCancel = React.useCallback(() => {
    dispatch(Chat2Gen.createToggleReplyToMessage({conversationIDKey}))
  }, [conversationIDKey, dispatch])

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
                    <Kb.Image src={imageURL} style={{...(sizing ? sizing.dims : {})}} />
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

const styles = Styles.styleSheetCreate(
  () =>
    ({
      close: {alignSelf: 'flex-start'},
      container: Styles.platformStyles({
        isElectron: {
          ...Styles.desktopStyles.boxShadow,
          borderRadius: Styles.borderRadius,
        },
      }),
      contentContainer: Styles.platformStyles({
        isMobile: {flex: 1},
      }),
      outerContainer: Styles.platformStyles({
        isElectron: {
          marginBottom: Styles.globalMargins.xtiny,
          marginLeft: Styles.globalMargins.small,
          marginRight: Styles.globalMargins.small,
          position: 'relative',
        },
      }),
      replyContainer: {
        justifyContent: 'space-between',
        padding: Styles.globalMargins.tiny,
      },
      replyImageContainer: {
        overflow: 'hidden',
        position: 'relative',
      },
      text: Styles.platformStyles({
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
        backgroundColor: Styles.globalColors.blueGrey,
        paddingBottom: Styles.globalMargins.tiny,
        paddingLeft: Styles.globalMargins.xsmall,
        paddingRight: Styles.globalMargins.xsmall,
        paddingTop: Styles.globalMargins.tiny,
      },
      username: {alignSelf: 'center'},
    } as const)
)

export default ReplyPreview
