// @flow
import * as React from 'react'
import * as Types from '../../../../constants/types/chat2'
import {Markdown} from '../../../../common-adapters'
import {globalColors, globalMargins, platformStyles, styleSheetCreate} from '../../../../styles'

export type Props = {
  text: string,
  type: 'error' | 'pending' | 'sent',
  isEditing: boolean,
  mentionsAt: Types.MentionsAt,
  mentionsChannel: Types.MentionsChannel,
  mentionsChannelName: Types.MentionsChannelName,
}

const MessageText = ({text, type, isEditing, mentionsAt, mentionsChannel, mentionsChannelName}: Props) => (
  <Markdown
    style={getStyle(type, isEditing)}
    meta={{mentionsAt, mentionsChannel, mentionsChannelName}}
    allowFontScaling={true}
  >
    {text}
  </Markdown>
)

// Encoding all 4 states as static objects so we don't re-render
const getStyle = (type, isEditing) => {
  if (type === 'sent') {
    return isEditing ? styles.sentEditing : styles.sent
  } else {
    return isEditing ? styles.pendingFailEditing : styles.pendingFail
  }
}

const editing = {
  backgroundColor: globalColors.yellow3,
  borderRadius: 2,
  paddingLeft: globalMargins.tiny,
  paddingRight: globalMargins.tiny,
}
const sent = platformStyles({
  common: {
    width: '100%',
  },
  isElectron: {
    // Make text selectable. On mobile we implement that differently.
    cursor: 'text',
    userSelect: 'text',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  isMobile: {
    backgroundColor: globalColors.fastBlank,
    color: globalColors.black_75_on_white,
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
const styles = styleSheetCreate({
  editing,
  pendingFail,
  pendingFailEditing,
  sent,
  sentEditing,
})

export default MessageText
