// @flow
import React from 'react'
import Text from './text'

export type Props = {
  key: string,
  channel: string,
  onClick: () => void,
  style: Object,
  allowFontScaling?: boolean,
}

export default ({key, channel, onClick, style, allowFontScaling}: Props) => (
  <Text type="BodyPrimaryLink" onClick={onClick} key={key} style={style} allowFontScaling={allowFontScaling}>
    #{channel}
  </Text>
)
