// @flow
import * as React from 'react'
import * as Types from '../../../../constants/types/chat'
import {Markdown} from '../../../../common-adapters'
import {globalColors, isMobile} from '../../../../styles'

export type Props = {
  text: string,
  type: 'failed' | 'pending' | 'sent',
  isEditing: boolean,
  mentions: Types.Mentions,
  channelMention: Types.ChannelMention,
  channelNameMentions: Types.ChannelNameMentions,
}

const MessageText = ({text, type, isEditing, mentions, channelMention, channelNameMentions}: Props) => (
  <Markdown
    style={getStyle(type, isEditing)}
    meta={{mentions, channelMention, channelNameMentions}}
    allowFontScaling={true}
  >
    {text}
  </Markdown>
)

// Encoding all 4 states as static objects so we don't re-render
const getStyle = (type, isEditing) => {
  if (type === 'sent') {
    return isEditing && isMobile ? sentEditingStyle : sentStyle
  } else {
    return isEditing && isMobile ? pendingFailEditingStyle : pendingFailStyle
  }
}

const editingStyle = {
  borderColor: globalColors.blue,
  borderRadius: 8,
  borderWidth: 1,
  margin: 2,
  padding: 2,
}

const sentStyle = {
  flex: 1,
  ...(isMobile
    ? {
        color: globalColors.black_75,
      }
    : {
        whiteSpace: 'pre-wrap',
        // Make text selectable. On mobile we implement that
        // differently.
        userSelect: 'text',
        cursor: 'text',
      }),
}

const sentEditingStyle = {
  ...sentStyle,
  ...editingStyle,
}

const pendingFailStyle = {
  ...sentStyle,
  color: globalColors.black_40,
}

const pendingFailEditingStyle = {
  ...pendingFailStyle,
  ...editingStyle,
}

export default MessageText
