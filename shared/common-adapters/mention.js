// @flow
import React from 'react'
import Text from './text'
import {globalColors} from '../styles'
import {isMobile} from '../constants/platform'

export type Props = {
  key: string,
  username: string,
  theme: 'follow' | 'nonFollow' | 'highlight' | 'none',
  onClick: ?() => void,
  style?: ?Object,
}

const mentionStyles = {
  follow: {
    color: globalColors.green2,
  },
  nonFollow: {
    color: globalColors.blue,
  },
  highlight: {
    backgroundColor: globalColors.yellow,
  },
  none: {},
}

export default ({key, username, theme, style, onClick}: Props) => (
  <Text
    type="BodySemibold"
    onClick={onClick || undefined}
    key={key}
    className={isMobile ? undefined : 'hover-underline'}
    style={{...style, ...mentionStyles[theme]}}
  >
    @{username}
  </Text>
)
