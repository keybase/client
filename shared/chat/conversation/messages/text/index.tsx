import * as React from 'react'
import * as Types from '../../../../constants/types/chat2'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'

type ReplyProps = {
  deleted: boolean
  edited: boolean
  onClick: () => void
  text: string
  username: string
}

const Reply = (props: ReplyProps) => {
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
        <Kb.Box2 direction="vertical">
          <Kb.Box2 direction="horizontal" gap="xtiny" fullWidth={true}>
            <Kb.Avatar username={props.username} size={32} />
            <Kb.Text type="BodySemibold" style={styles.replyUsername}>
              {props.username}
            </Kb.Text>
          </Kb.Box2>
          {!props.deleted ? (
            <Kb.Text type="BodySmall">{props.text}</Kb.Text>
          ) : (
            <Kb.Text type="BodyTiny" style={styles.replyEdited}>
              Original message deleted
            </Kb.Text>
          )}
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

export type Props = {
  isEditing: boolean
  // eslint-disable-next-line
  message: Types.MessageText
  reply?: ReplyProps
  text: string
  type: 'error' | 'pending' | 'sent'
}

const MessageText = ({isEditing, message, reply, text, type}: Props) => {
  const markdown = (
    <Kb.Markdown
      style={getStyle(type, isEditing)}
      meta={{message}}
      styleOverride={Styles.isMobile ? {paragraph: getStyle(type, isEditing)} : undefined}
      allowFontScaling={true}
    >
      {text}
    </Kb.Markdown>
  )
  const content = (
    <Kb.Box2 direction="vertical" gap="tiny" fullWidth={true}>
      {!!reply && <Reply {...reply} />}
      {markdown}
    </Kb.Box2>
  )

  return Styles.isMobile ? (
    <Kb.Box2 direction="vertical" style={styles.wrapper}>
      {content}
    </Kb.Box2>
  ) : (
    content
  )
}

// Encoding all 4 states as static objects so we don't re-render
const getStyle = (type, isEditing) => {
  if (type === 'sent') {
    return isEditing ? styles.sentEditing : styles.sent
  } else {
    return isEditing ? styles.pendingFailEditing : styles.pendingFail
  }
}

const editing = {
  backgroundColor: Styles.globalColors.yellowLight,
  borderRadius: 2,
  paddingLeft: Styles.globalMargins.tiny,
  paddingRight: Styles.globalMargins.tiny,
}
const sent = Styles.platformStyles({
  isElectron: {
    // Make text selectable. On mobile we implement that differently.
    cursor: 'text',
    userSelect: 'text',
    whiteSpace: 'pre-wrap',
    width: '100%',
    wordBreak: 'break-word',
  },
  isMobile: {
    ...Styles.globalStyles.flexBoxColumn,
  },
})
const sentEditing = {
  ...sent,
  ...editing,
}
const pendingFail = {
  ...sent,
}
const pendingFailEditing = {
  ...pendingFail,
  ...editing,
}
const styles = Styles.styleSheetCreate({
  editing,
  pendingFail,
  pendingFailEditing,
  quoteContainer: {
    alignSelf: 'stretch',
    backgroundColor: Styles.globalColors.greyLight,
    paddingLeft: Styles.globalMargins.xtiny,
  },
  replyContainer: {
    paddingTop: Styles.globalMargins.xtiny,
  },
  replyEdited: {
    color: Styles.globalColors.black_20,
  },
  replyUsername: {
    alignSelf: 'center',
  },
  sent,
  sentEditing,
  wrapper: {alignSelf: 'flex-start', flex: 1},
})

export default MessageText
