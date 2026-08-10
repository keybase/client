import * as Kb from '@/common-adapters'
import * as React from 'react'
import {zoomImage} from '@/constants/chat/helpers'
import {useIsHighlighted} from '../ids-context'
import {ZoomedImage} from '../../common'
import type * as T from '@/constants/types'

export const useReply = (replyTo?: T.Chat.MessageReplyTo, onClick?: () => void) => {
  return replyTo ? <Reply replyTo={replyTo} onClick={onClick} /> : null
}

const ReplyToContext = React.createContext<T.Chat.MessageReplyTo>(null!)
ReplyToContext.displayName = 'ReplyToContext'

const AvatarHolder = () => {
  const styles = useStyles()
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
  const sizing = imageWidth && imageHeight ? zoomImage(imageWidth, imageHeight, 80) : undefined
  return <ZoomedImage src={imageURL} sizing={sizing} />
}

const ReplyText = () => {
  const styles = useStyles()
  const replyTo = React.useContext(ReplyToContext)
  const showCenteredHighlight = useIsHighlighted()

  const text =
    replyTo.type === 'attachment'
      ? replyTo.title || (replyTo.attachmentType === 'image' ? '' : replyTo.fileName)
      : replyTo.type === 'text'
        ? replyTo.text?.stringValue() ?? ''
        : ''

  return text ? (
    <Kb.Markdown
      serviceOnly={true}
      lineClamp={3}
      context={`reply-${replyTo.id}`}
      style={
        showCenteredHighlight
          ? Kb.Styles.collapseStyles([styles.replyText, styles.replyTextHighlighted])
          : styles.replyText
      }
    >
      {text}
    </Kb.Markdown>
  ) : null
}

type RS = {
  showImage: boolean
  showEdited: boolean
  isDeleted: boolean
  onClick?: () => void
}

function ReplyStructure(p: RS) {
  const styles = useStyles()
  const {showImage, showEdited, isDeleted, onClick} = p

  return (
    <Kb.ClickableBox direction="horizontal" gap="tiny" fullWidth={true} style={styles.replyContainer} className={Kb.Styles.classNames('ReplyBox')} onClick={onClick}>
      <Kb.Box2 direction="horizontal" alignSelf="stretch" style={styles.quoteContainer} />
      <Kb.Box2 direction="vertical" gap="xtiny" flex={1}>
        <Kb.Box2 direction="horizontal" fullWidth={true}>
          <AvatarHolder />
        </Kb.Box2>
        <Kb.Box2 direction="horizontal" fullWidth={true} gap="tiny">
          {showImage && <ReplyImage />}
          <Kb.Box2 direction="horizontal" flex={1} alignSelf="flex-start">
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
    </Kb.ClickableBox>
  )
}

function Reply({replyTo, onClick}: {onClick?: () => void; replyTo: T.Chat.MessageReplyTo}) {
  if (!replyTo.id) return null

  const showEdited = !!replyTo.hasBeenEdited
  const isDeleted = replyTo.exploded || replyTo.type === 'deleted'
  const showImage = !!replyTo.previewURL

  return (
    <ReplyToContext value={replyTo}>
      <ReplyStructure isDeleted={isDeleted} showImage={showImage} showEdited={showEdited} onClick={onClick} />
    </ReplyToContext>
  )
}

const useStyles = Kb.Styles.createStyleHook(
  theme =>
    ({
      quoteContainer: {
        backgroundColor: theme.grey,
        paddingLeft: Kb.Styles.globalMargins.xtiny,
      },
      replyContainer: {
        paddingBottom: Kb.Styles.globalMargins.tiny,
        paddingTop: Kb.Styles.globalMargins.xtiny,
      },
      replyEdited: {color: theme.black_35},
      replyText: Kb.Styles.platformStyles({
        common: {color: theme.black_50, fontSize: 15, lineHeight: 19},
        isElectron: {whiteSpace: 'pre-wrap'},
      }),
      replyTextHighlighted: {color: theme.black_50OrBlack_50},
      replyUsername: {alignSelf: 'center'},
      replyUsernameHighlighted: {color: theme.blackOrBlack},
    }) as const
)
