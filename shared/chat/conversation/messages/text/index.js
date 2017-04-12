// @flow
import React from 'react'
import {Markdown} from '../../../../common-adapters'
import {globalStyles, globalColors} from '../../../../styles'
import {isMobile} from '../../../../constants/platform'

export type Props = {
  text: string,
  type: 'failed' | 'pending' | 'sent',
  isEditing: boolean,
}

const MessageText = ({text, type, isEditing}: Props) => (
  <Markdown style={getStyle(type, isEditing)}>{text}</Markdown>
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
  ...globalStyles.selectable,
  color: globalColors.black,
  flex: 1,
  ...(isMobile ? {} : {
    whiteSpace: 'pre-wrap',
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
