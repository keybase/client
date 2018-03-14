// @flow
import React from 'react'
import Text from './text'
import {type ConversationIDKey} from '../constants/types/chat2'

export type Props = {
  name: string,
  convID: ConversationIDKey,
  style: any,
  allowFontScaling?: ?boolean,
  onClick: () => void,
}

export const Channel = ({name, onClick, style, allowFontScaling}: Props) => (
  <Text type="BodyPrimaryLink" onClick={onClick} style={style} allowFontScaling={!!allowFontScaling}>
    #{name}
  </Text>
)
