import * as Constants from '../../../../constants/chat2'
import * as Container from '../../../../util/container'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import * as Kb from '../../../../common-adapters'
import * as React from 'react'
import * as Styles from '../../../../styles'
import {ConvoIDContext, OrdinalContext, GetIdsContext, HighlightedContext} from '../ids-context'
import type * as Types from '../../../../constants/types/chat2'

export const useReply = (ordinal: Types.Ordinal) => {
  const conversationIDKey = React.useContext(ConvoIDContext)
  const showReplyTo = Container.useSelector(
    state => !!state.chat2.messageMap.get(conversationIDKey)?.get(ordinal)?.replyTo
  )
  return showReplyTo ? <Reply /> : null
}

const emptyMessage = Constants.makeMessageText()

const ReplyToContext = React.createContext<Types.Message>(emptyMessage)

const AvatarHolder = () => {
  const {author} = React.useContext(ReplyToContext)
  const showCenteredHighlight = React.useContext(HighlightedContext)
  return (
    <Kb.Box2 direction="horizontal" gap="xtiny" fullWidth={true}>
      <Kb.Avatar username={author} size={16} />
      <Kb.Text
        type="BodySmallBold"
        style={
          showCenteredHighlight
            ? Styles.collapseStyles([styles.replyUsername, styles.replyUsernameHighlighted])
            : styles.replyUsername
        }
      >
        {author}
      </Kb.Text>
    </Kb.Box2>
  )
}

const ReplyImage = () => {
  const replyTo = React.useContext(ReplyToContext)
  if (replyTo.type !== 'attachment') return null

  const imageHeight = replyTo.previewHeight
  const imageURL = replyTo.previewURL
  const imageWidth = replyTo.previewWidth
  const sizing = imageWidth && imageHeight ? Constants.zoomImage(imageWidth, imageHeight, 80) : undefined
  return (
    <Kb.Box2 direction="vertical" style={styles.replyImageContainer}>
      <Kb.Box style={sizing?.margins}>
        <Kb.Image src={imageURL} style={sizing?.dims} />
      </Kb.Box>
    </Kb.Box2>
  )
}

const ReplyText = () => {
  const replyTo = React.useContext(ReplyToContext)
  const showCenteredHighlight = React.useContext(HighlightedContext)

  const text =
    replyTo.type === 'attachment'
      ? replyTo.title || (replyTo.attachmentType === 'image' ? '' : replyTo.fileName)
      : replyTo.type === 'text'
      ? replyTo.text.stringValue()
      : ''

  return text ? (
    <Kb.Text
      type="BodySmall"
      style={showCenteredHighlight ? styles.textHighlighted : undefined}
      lineClamp={3}
    >
      {text}
    </Kb.Text>
  ) : null
}

type RS = {
  showImage: boolean
  showEdited: boolean
  isDeleted: boolean
  onClick: () => void
}

const ReplyStructure = React.memo(function ReplyStructure(p: RS) {
  const {showImage, showEdited, isDeleted, onClick} = p

  return (
    <Kb.ClickableBox2 onClick={onClick}>
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
            <AvatarHolder />
          </Kb.Box2>
          <Kb.Box2 direction="horizontal" fullWidth={true} gap="tiny">
            {showImage && <ReplyImage />}
            <Kb.Box2 direction="horizontal" style={styles.replyTextContainer}>
              {isDeleted ? (
                <Kb.Text type="BodyTiny" style={styles.replyEdited}>
                  The original message was deleted.
                </Kb.Text>
              ) : (
                <ReplyText />
              )}
            </Kb.Box2>
          </Kb.Box2>
          {showEdited && (
            <Kb.Text type="BodyTiny" style={styles.replyEdited}>
              EDITED
            </Kb.Text>
          )}
        </Kb.Box2>
      </Kb.Box2>
    </Kb.ClickableBox2>
  )
})

const Reply = React.memo(function Repy() {
  const conversationIDKey = React.useContext(ConvoIDContext)
  const ordinal = React.useContext(OrdinalContext)
  const replyTo = Container.useSelector(state => {
    const m = state.chat2.messageMap.get(conversationIDKey)?.get(ordinal)
    return m?.replyTo ?? emptyMessage
  })

  const dispatch = Container.useDispatch()
  const getIds = React.useContext(GetIdsContext)
  const onClick = Container.useEvent(() => {
    const {conversationIDKey} = getIds()
    const id = replyTo.id
    id && dispatch(Chat2Gen.createReplyJump({conversationIDKey, messageID: id}))
  })

  if (!replyTo.id) return null

  const showEdited = !!replyTo.hasBeenEdited
  const isDeleted = replyTo.exploded || replyTo.type === 'deleted'
  const showImage = !!replyTo.previewURL

  return (
    <ReplyToContext.Provider value={replyTo}>
      <ReplyStructure isDeleted={isDeleted} showImage={showImage} showEdited={showEdited} onClick={onClick} />
    </ReplyToContext.Provider>
  )
})

const styles = Styles.styleSheetCreate(
  () =>
    ({
      quoteContainer: {
        alignSelf: 'stretch',
        backgroundColor: Styles.globalColors.grey,
        paddingLeft: Styles.globalMargins.xtiny,
      },
      replyContainer: {
        paddingBottom: Styles.globalMargins.tiny,
        paddingTop: Styles.globalMargins.xtiny,
      },
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
