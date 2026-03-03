import * as Chat from '@/stores/chat'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import {useOrdinal, useIsHighlighted} from '../ids-context'
import type * as T from '@/constants/types'

export const useReply = (ordinal: T.Chat.Ordinal) => {
  const showReplyTo = Chat.useChatContext(s => {
    const m = s.messageMap.get(ordinal)
    return m?.type === 'text' ? !!m.replyTo : false
  })
  return showReplyTo ? <Reply /> : null
}

const emptyMessage = Chat.makeMessageText()

const ReplyToContext = React.createContext<T.Chat.MessageReplyTo>(emptyMessage)

const AvatarHolder = () => {
  const {author} = React.useContext(ReplyToContext)
  const showCenteredHighlight = useIsHighlighted()
  return (
    <Kb.Box2 direction="horizontal" gap="xtiny" fullWidth={true}>
      <Kb.Avatar username={author} size={16} />
      <Kb.Text
        type="BodySmallBold"
        style={
          showCenteredHighlight
            ? Kb.Styles.collapseStyles([styles.replyUsername, styles.replyUsernameHighlighted])
            : styles.replyUsername
        }
        virtualText={true}
      >
        {author}
      </Kb.Text>
    </Kb.Box2>
  )
}

const ReplyImage = () => {
  const replyTo = React.useContext(ReplyToContext)
  if (replyTo.type !== 'attachment') return null
  const imageURL = replyTo.previewURL
  if (!imageURL) return null
  const imageHeight = replyTo.previewHeight
  const imageWidth = replyTo.previewWidth
  const sizing = imageWidth && imageHeight ? Chat.zoomImage(imageWidth, imageHeight, 80) : undefined
  return (
    <Kb.Box2 direction="vertical" relative={true} overflow="hidden">
      <Kb.Box2 direction="vertical" style={sizing?.margins}>
        <Kb.Image src={imageURL} style={sizing?.dims} />
      </Kb.Box2>
    </Kb.Box2>
  )
}

const ReplyText = () => {
  const replyTo = React.useContext(ReplyToContext)
  const showCenteredHighlight = useIsHighlighted()

  const text =
    replyTo.type === 'attachment'
      ? replyTo.title || (replyTo.attachmentType === 'image' ? '' : replyTo.fileName)
      : replyTo.type === 'text'
        ? replyTo.text?.stringValue() ?? ''
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

function ReplyStructure(p: RS) {
  const {showImage, showEdited, isDeleted, onClick} = p

  return (
    <Kb.ClickableBox2 onClick={onClick}>
      <Kb.Box2
        direction="horizontal"
        gap="tiny"
        fullWidth={true}
        style={styles.replyContainer}
        className={Kb.Styles.classNames('ReplyBox')}
      >
        <Kb.Box2 direction="horizontal" style={styles.quoteContainer} />
        <Kb.Box2 direction="vertical" gap="xtiny" flex={1}>
          <Kb.Box2 direction="horizontal" fullWidth={true}>
            <AvatarHolder />
          </Kb.Box2>
          <Kb.Box2 direction="horizontal" fullWidth={true} gap="tiny">
            {showImage && <ReplyImage />}
            <Kb.Box2 direction="horizontal" flex={1} style={styles.replyTextContainer}>
              {isDeleted ? (
                <Kb.Text type="BodyTiny" style={styles.replyEdited} virtualText={true}>
                  The original message was deleted.
                </Kb.Text>
              ) : (
                <ReplyText />
              )}
            </Kb.Box2>
          </Kb.Box2>
          {showEdited && (
            <Kb.Text type="BodyTiny" style={styles.replyEdited} virtualText={true}>
              EDITED
            </Kb.Text>
          )}
        </Kb.Box2>
      </Kb.Box2>
    </Kb.ClickableBox2>
  )
}

function Reply() {
  const ordinal = useOrdinal()
  const replyTo = Chat.useChatContext(s => {
    const m = s.messageMap.get(ordinal)
    return m?.type === 'text' ? m.replyTo : undefined
  })

  const replyJump = Chat.useChatContext(s => s.dispatch.replyJump)
  const onClick = () => {
    const id = replyTo?.id ?? 0
    id && replyJump(id)
  }

  if (!replyTo?.id) return null

  const showEdited = !!replyTo.hasBeenEdited
  const isDeleted = replyTo.exploded || replyTo.type === 'deleted'
  const showImage = !!replyTo.previewURL

  return (
    <ReplyToContext.Provider value={replyTo}>
      <ReplyStructure isDeleted={isDeleted} showImage={showImage} showEdited={showEdited} onClick={onClick} />
    </ReplyToContext.Provider>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      quoteContainer: {
        alignSelf: 'stretch',
        backgroundColor: Kb.Styles.globalColors.grey,
        paddingLeft: Kb.Styles.globalMargins.xtiny,
      },
      replyContainer: {
        paddingBottom: Kb.Styles.globalMargins.tiny,
        paddingTop: Kb.Styles.globalMargins.xtiny,
      },
      replyEdited: {color: Kb.Styles.globalColors.black_35},
      replyTextContainer: {
        alignSelf: 'flex-start',
      },
      replyUsername: {alignSelf: 'center'},
      replyUsernameHighlighted: {color: Kb.Styles.globalColors.blackOrBlack},
      textHighlighted: {color: Kb.Styles.globalColors.black_50OrBlack_50},
    }) as const
)
