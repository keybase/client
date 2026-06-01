import {zoomImage} from '@/constants/chat/helpers'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import * as InputState from './input-area/input-state'
import {useConversationThreadMessage} from './thread-context'

const ReplyPreview = () => {
  const rordinal = InputState.useConversationInput(s => s.replyTo)
  const message = useConversationThreadMessage(rordinal)
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
  const sizing = imageWidth && imageHeight ? zoomImage(imageWidth, imageHeight, 80) : null
  const setReplyTo = InputState.useConversationInputDispatch(s => s.setReplyTo)
  const onCancel = () => {
    setReplyTo(T.Chat.numberToOrdinal(0))
  }

  return (
    <Kb.Box2 direction="vertical" alignSelf="stretch" style={styles.outerContainer}>
      <Kb.Box2 direction="vertical" style={styles.container} gap="xtiny" fullWidth={true}>
        <Kb.Box2 direction="vertical" style={styles.title} fullWidth={true}>
          <Kb.Text type="BodySmallSemibold">Replying to:</Kb.Text>
        </Kb.Box2>
        <Kb.Box2 direction="horizontal" fullWidth={true} justifyContent="space-between" style={styles.replyContainer}>
          <Kb.Box2 direction="vertical" alignSelf="stretch" flex={1} style={styles.contentContainer} gap="tiny">
            <Kb.Box2 direction="horizontal" gap="xtiny" fullWidth={true}>
              <Kb.Avatar username={username} size={32} />
              <Kb.Text type="BodyBold" style={styles.username}>
                {username}
              </Kb.Text>
            </Kb.Box2>
            <Kb.Box2 direction="horizontal" fullWidth={true} gap="tiny">
              {!!imageURL && (
                <Kb.Box2 direction="vertical" overflow="hidden" relative={true}>
                  <Kb.Box2 direction="vertical" style={{...(sizing ? sizing.margins : {})}}>
                    <Kb.Image src={imageURL} style={{...(sizing ? sizing.dims : {})}} />
                  </Kb.Box2>
                </Kb.Box2>
              )}
              <Kb.Text type="BodySmall" style={styles.text} lineClamp={1}>
                {text}
              </Kb.Text>
            </Kb.Box2>
          </Kb.Box2>
          <Kb.Icon onClick={onCancel} type="iconfont-remove" style={styles.close} />
        </Kb.Box2>
      </Kb.Box2>
    </Kb.Box2>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      close: {alignSelf: 'flex-start', flexShrink: 0},
      container: Kb.Styles.platformStyles({
        isElectron: {
          ...Kb.Styles.desktopStyles.boxShadow,
          borderRadius: Kb.Styles.borderRadius,
        },
      }),
      contentContainer: {minWidth: 0},
      outerContainer: Kb.Styles.platformStyles({
        isElectron: {
          marginBottom: Kb.Styles.globalMargins.xtiny,
          ...Kb.Styles.marginH(Kb.Styles.globalMargins.small),
          position: 'relative',
        },
      }),
      replyContainer: {
        padding: Kb.Styles.globalMargins.tiny,
      },
      text: Kb.Styles.platformStyles({
        isElectron: {
          contain: 'strict',
          display: 'inline',
          flex: 1,
          height: 20,
          ...Kb.Styles.textEllipsis,
        },
        isMobile: {flex: 1},
      }),
      title: {
        backgroundColor: Kb.Styles.globalColors.blueGrey,
        ...Kb.Styles.padding(Kb.Styles.globalMargins.tiny, Kb.Styles.globalMargins.xsmall),
      },
      username: {alignSelf: 'center'},
    }) as const
)

export default ReplyPreview
