// @flow
import React from 'react'
import Text from './text'
import * as Styles from '../styles'

export type OwnProps = {|
  username: string,
  theme?: 'follow' | 'nonFollow' | 'highlight' | 'none',
  style?: Styles.StylesCrossPlatform,
  allowFontScaling?: boolean,
|}

export type Props = {|
  ...OwnProps,
  onClick: () => void,
|}

export default ({username, theme, style, allowFontScaling, onClick}: Props) => (
  <Text
    type="BodySemibold"
    onClick={onClick || undefined}
    className={Styles.isMobile ? undefined : 'hover-underline'}
    style={Styles.collapseStyles([style, styles[theme || 'none']])}
    allowFontScaling={allowFontScaling}
  >
    @{username}
  </Text>
)

const styles = Styles.styleSheetCreate({
  follow: {
    backgroundColor: Styles.globalColors.green3,
    borderRadius: 2,
    color: Styles.globalColors.green,
  },
  highlight: {
    backgroundColor: Styles.globalColors.yellow,
    borderRadius: 2,
  },
  nonFollow: {
    backgroundColor: Styles.globalColors.blue4,
    borderRadius: 2,
    color: Styles.globalColors.blue,
  },
  none: {
    borderRadius: 2,
  },
})
