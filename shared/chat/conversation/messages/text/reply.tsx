import * as Constants from '../../../../constants/chat2'
import * as Container from '../../../../util/container'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import * as Kb from '../../../../common-adapters'
import * as React from 'react'
import * as Styles from '../../../../styles'
import {ConvoIDContext, OrdinalContext} from '../ids-context'
import type * as Types from '../../../../constants/types/chat2'

export const useReply = (ordinal: Types.Ordinal, showCenteredHighlight: boolean) => {
  const conversationIDKey = React.useContext(ConvoIDContext)
  const showReplyTo = Container.useSelector(
    state => !!state.chat2.messageMap.get(conversationIDKey)?.get(ordinal)?.replyTo
  )
  return showReplyTo ? <Reply isParentHighlighted={showCenteredHighlight} /> : null
}

const emptyMessage = Constants.makeMessageDeleted()

const Reply = (p: {isParentHighlighted: boolean}) => {
  const {isParentHighlighted} = p
  const conversationIDKey = React.useContext(ConvoIDContext)
  const ordinal = React.useContext(OrdinalContext)
  const replyTo = Container.useSelector(state => {
    const m = state.chat2.messageMap.get(conversationIDKey)?.get(ordinal)
    return m?.replyTo ?? emptyMessage
  })

  const dispatch = Container.useDispatch()

  const {id, type} = replyTo

  const onReplyClick = React.useCallback(() => {
    id && dispatch(Chat2Gen.createReplyJump({conversationIDKey, messageID: id}))
  }, [dispatch, conversationIDKey, id])

  const [imageLoaded, setImageLoaded] = React.useState(false)

  if (!id) return null

  let deleted = true
  let edited = false
  let onClick: undefined | (() => void) = undefined
  let text = ''
  let username = ''
  let imageHeight = 0
  let imageURL = ''
  let imageWidth = 0

  switch (type) {
    case 'attachment': // fallthrough
    case 'text': {
      const attachment: Types.MessageAttachment | undefined =
        replyTo.type === 'attachment' && replyTo.attachmentType === 'image' ? replyTo : undefined
      if (!replyTo.exploded) {
        deleted = false
        edited = !!replyTo.hasBeenEdited
        imageHeight = attachment ? attachment.previewHeight : 0
        imageURL = attachment ? attachment.previewURL : ''
        imageWidth = attachment ? attachment.previewWidth : 0
        onClick = onReplyClick
        text =
          replyTo.type === 'attachment'
            ? replyTo.title || (replyTo.attachmentType === 'image' ? '' : replyTo.fileName)
            : replyTo.text.stringValue()
        username = replyTo.author
      }
      break
    }
    default:
      break
  }

  const sizing = imageWidth && imageHeight ? Constants.zoomImage(imageWidth, imageHeight, 80) : undefined
  return (
    <Kb.ClickableBox onClick={onClick}>
      <Kb.Box2
        direction="horizontal"
        gap="tiny"
        fullWidth={true}
        style={styles.replyContainer}
        className={Styles.classNames('ReplyBox')}
      >
        <Kb.Box2 direction="horizontal" style={styles.quoteContainer} />
        <Kb.Box2 direction="vertical" gap="xtiny" style={styles.replyContentContainer}>
          <Kb.Box2 direction="horizontal" fullWidth={true}>
            <Kb.Box2 direction="horizontal" gap="xtiny" fullWidth={true}>
              <Kb.Avatar username={username} size={16} />
              <Kb.Text
                type="BodySmallBold"
                style={Styles.collapseStyles([
                  styles.replyUsername,
                  isParentHighlighted && styles.replyUsernameHighlighted,
                ])}
              >
                {username}
              </Kb.Text>
            </Kb.Box2>
          </Kb.Box2>
          <Kb.Box2 direction="horizontal" fullWidth={true} gap="tiny">
            {!!imageURL && (
              <Kb.Box2 direction="vertical" style={styles.replyImageContainer}>
                <Kb.Box style={{...(sizing ? sizing.margins : {})}}>
                  <Kb.Image
                    src={imageURL}
                    onLoad={() => setImageLoaded(true)}
                    style={{...(sizing ? sizing.dims : {})}}
                  />
                  {!imageLoaded && <Kb.ProgressIndicator style={styles.replyProgress} />}
                </Kb.Box>
              </Kb.Box2>
            )}
            <Kb.Box2 direction="horizontal" style={styles.replyTextContainer}>
              {!deleted ? (
                <Kb.Text
                  type="BodySmall"
                  style={Styles.collapseStyles([isParentHighlighted && styles.textHighlighted])}
                  lineClamp={3}
                >
                  {text}
                </Kb.Text>
              ) : (
                <Kb.Text type="BodyTiny" style={styles.replyEdited}>
                  The original message was deleted.
                </Kb.Text>
              )}
            </Kb.Box2>
          </Kb.Box2>
          {edited && (
            <Kb.Text type="BodyTiny" style={styles.replyEdited}>
              EDITED
            </Kb.Text>
          )}
        </Kb.Box2>
      </Kb.Box2>
    </Kb.ClickableBox>
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      quoteContainer: {
        alignSelf: 'stretch',
        backgroundColor: Styles.globalColors.grey,
        paddingLeft: Styles.globalMargins.xtiny,
      },
      replyContainer: {paddingTop: Styles.globalMargins.xtiny},
      replyContentContainer: {flex: 1},
      replyEdited: {color: Styles.globalColors.black_35},
      replyImageContainer: {
        overflow: 'hidden',
        position: 'relative',
      },
      replyProgress: {
        bottom: '50%',
        left: '50%',
        marginBottom: -12,
        marginLeft: -12,
        marginRight: -12,
        marginTop: -12,
        position: 'absolute',
        right: '50%',
        top: '50%',
        width: 24,
      },
      replyTextContainer: {
        alignSelf: 'flex-start',
        flex: 1,
      },
      replyUsername: {alignSelf: 'center'},
      replyUsernameHighlighted: {color: Styles.globalColors.blackOrBlack},
      textHighlighted: {color: Styles.globalColors.black_50OrBlack_50},
    } as const)
)
