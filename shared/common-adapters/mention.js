// @flow
import React from 'react'
import Text from './text'
import {globalColors, isMobile} from '../styles'

export type OwnProps = {
  username: string,
  theme?: 'follow' | 'nonFollow' | 'highlight' | 'none',
  style?: ?Object,
  allowFontScaling?: boolean,
}

export type Props = OwnProps & {
  onClick: ?() => void,
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

export default ({username, theme, style, allowFontScaling, onClick}: Props) => (
  <Text
    type="BodySemibold"
    onClick={onClick || undefined}
    className={isMobile ? undefined : 'hover-underline'}
    style={{...style, ...mentionStyles[theme || 'none'], borderRadius: 2}}
    allowFontScaling={allowFontScaling}
  >
    @{username}
  </Text>
)
