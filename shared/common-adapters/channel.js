// @flow
import React from 'react'
import Text from './text'
import {type ConversationIDKey} from '../constants/types/chat'

export type OwnProps = {
  key: string,
  channel: string,
  convID: ConversationIDKey,
  style: Object,
  allowFontScaling?: boolean,
}

export type Props = OwnProps & {
  onClick: () => void,
}

export const Channel = ({key, channel, onClick, style, allowFontScaling}: Props) => (
  <Text type="BodyPrimaryLink" onClick={onClick} key={key} style={style} allowFontScaling={allowFontScaling}>
    #{channel}
  </Text>
)
