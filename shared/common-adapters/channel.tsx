import React from 'react'
import Text from './text'
import {ConversationIDKey} from '../constants/types/chat2'
import {StylesCrossPlatform} from '../styles'

export type Props = {
  name: string
  convID: ConversationIDKey
  style: StylesCrossPlatform
  allowFontScaling?: boolean | null
  onClick: () => void
}

export const Channel = ({name, onClick, style, allowFontScaling}: Props) => (
  <Text type="BodyPrimaryLink" onClick={onClick} style={style} allowFontScaling={!!allowFontScaling}>
    #{name}
  </Text>
)
