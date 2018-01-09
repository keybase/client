// @flow
import React from 'react'
import Text from './text'
import {globalColors, isMobile} from '../styles'

export type Props = {
  key: string,
  username: string,
  theme: 'follow' | 'nonFollow' | 'highlight' | 'none',
  onClick: ?() => void,
  style?: ?Object,
  allowFontScaling?: boolean,
}

const mentionStyles = {
  follow: {
    color: globalColors.green2,
    backgroundColor: globalColors.green3,
  },
  nonFollow: {
    color: globalColors.blue,
    backgroundColor: globalColors.blue4,
  },
  highlight: {
    backgroundColor: globalColors.yellow,
  },
  none: {},
}

export default ({key, username, theme, style, allowFontScaling, onClick}: Props) => (
  <Text
    type="BodySemibold"
    onClick={onClick || undefined}
    key={key}
    className={isMobile ? undefined : 'hover-underline'}
    style={{...style, ...mentionStyles[theme], borderRadius: 2}}
    allowFontScaling={allowFontScaling}
  >
    @{username}
  </Text>
)
