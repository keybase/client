import * as Constants from '../../../../constants/chat2'
import * as Container from '../../../../util/container'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import * as Kb from '../../../../common-adapters'
import * as React from 'react'
import * as Styles from '../../../../styles'
import {ConvoIDContext} from '../ids-context'
import type * as Types from '../../../../constants/types/chat2'
import shallowEqual from 'shallowequal'

const replyNoop = () => {}

export type ReplyProps = {
  deleted: boolean
  edited: boolean
  imageHeight?: number
  imageURL?: string
  imageWidth?: number
  isParentHighlighted?: boolean
  onClick: () => void
  text: string
  username: string
}

export const useReply = (ordinal: Types.Ordinal, showCenteredHighlight: boolean) => {
  const conversationIDKey = React.useContext(ConvoIDContext)
  const replyTo = Container.useSelector(state => {
    const m = state.chat2.messageMap.get(conversationIDKey)?.get(ordinal)
    const replyTo = m?.replyTo
    return replyTo
  }, shallowEqual)

  const replyProps = useGetReplyProps(replyTo || undefined, conversationIDKey)
  return replyProps ? <Reply {...replyProps} isParentHighlighted={showCenteredHighlight} /> : null
}

const useGetReplyProps = (replyTo: Types.Message | undefined, conversationIDKey: Types.ConversationIDKey) => {
  const dispatch = Container.useDispatch()

  const replyToId = replyTo?.id

  const onReplyClick = React.useCallback(() => {
    replyToId && dispatch(Chat2Gen.createReplyJump({conversationIDKey, messageID: replyToId}))
  }, [dispatch, conversationIDKey, replyToId])

  if (!replyTo) {
    return undefined
  }
  const deletedProps = {
    deleted: true,
    edited: false,
    onClick: replyNoop,
    text: '',
    username: '',
  }
  switch (replyTo.type) {
    case 'attachment':
    case 'text': {
      const attachment: Types.MessageAttachment | undefined =
        replyTo.type === 'attachment' && replyTo.attachmentType === 'image' ? replyTo : undefined
      return replyTo.exploded
        ? deletedProps
        : {
            deleted: false,
            edited: !!replyTo.hasBeenEdited,
            imageHeight: attachment ? attachment.previewHeight : undefined,
            imageURL: attachment ? attachment.previewURL : undefined,
            imageWidth: attachment ? attachment.previewWidth : undefined,
            onClick: onReplyClick,
            text:
              replyTo.type === 'attachment'
                ? replyTo.title || (replyTo.attachmentType === 'image' ? '' : replyTo.fileName)
                : replyTo.text.stringValue(),
            username: replyTo.author,
          }
    }
    case 'deleted':
    case 'placeholder':
      return deletedProps
  }
  return undefined
}

const Reply = (props: ReplyProps) => {
  const [imageLoaded, setImageLoaded] = React.useState(false)
  const sizing =
    props.imageWidth && props.imageHeight
      ? Constants.zoomImage(props.imageWidth, props.imageHeight, 80)
      : undefined
  return (
    <Kb.ClickableBox onClick={props.onClick}>
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
              <Kb.Avatar username={props.username} size={16} />
              <Kb.Text
                type="BodySmallBold"
                style={Styles.collapseStyles([
                  styles.replyUsername,
                  props.isParentHighlighted && styles.replyUsernameHighlighted,
                ])}
              >
                {props.username}
              </Kb.Text>
            </Kb.Box2>
          </Kb.Box2>
          <Kb.Box2 direction="horizontal" fullWidth={true} gap="tiny">
            {!!props.imageURL && (
              <Kb.Box2 direction="vertical" style={styles.replyImageContainer}>
                <Kb.Box style={{...(sizing ? sizing.margins : {})}}>
                  <Kb.Image
                    src={props.imageURL}
                    onLoad={() => setImageLoaded(true)}
                    style={{...(sizing ? sizing.dims : {})}}
                  />
                  {!imageLoaded && <Kb.ProgressIndicator style={styles.replyProgress} />}
                </Kb.Box>
              </Kb.Box2>
            )}
            <Kb.Box2 direction="horizontal" style={styles.replyTextContainer}>
              {!props.deleted ? (
                <Kb.Text
                  type="BodySmall"
                  style={Styles.collapseStyles([props.isParentHighlighted && styles.textHighlighted])}
                  lineClamp={3}
                >
                  {props.text}
                </Kb.Text>
              ) : (
                <Kb.Text type="BodyTiny" style={styles.replyEdited}>
                  The original message was deleted.
                </Kb.Text>
              )}
            </Kb.Box2>
          </Kb.Box2>
          {props.edited && (
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
