// @flow
import * as React from 'react'
import * as Types from '../../../../constants/types/chat2'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'

export type Props = {
  text: string,
  type: 'error' | 'pending' | 'sent',
  isEditing: boolean,
  mentionsAt: Types.MentionsAt,
  mentionsChannel: Types.MentionsChannel,
  mentionsChannelName: Types.MentionsChannelName,
}

const MessageText = ({text, type, isEditing, mentionsAt, mentionsChannel, mentionsChannelName}: Props) => {
  const markdown = (
    <Kb.Markdown
      style={getStyle(type, isEditing)}
      meta={{mentionsAt, mentionsChannel, mentionsChannelName}}
      styleOverride={Styles.isMobile ? {paragraph: getStyle(type, isEditing)} : undefined}
      allowFontScaling={true}
    >
      {text}
    </Kb.Markdown>
  )

  return Styles.isMobile ? (
    <Kb.Box2 direction="vertical" style={styles.wrapper}>
      {markdown}
    </Kb.Box2>
  ) : (
    markdown
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
  backgroundColor: Styles.globalColors.yellow3,
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
    backgroundColor: Styles.globalColors.fastBlank,
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
  sent,
  sentEditing,
  wrapper: {alignSelf: 'flex-start', flexGrow: 1},
})

export default MessageText
