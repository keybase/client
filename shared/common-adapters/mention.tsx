import React from 'react'
import Text from './text'
import * as Styles from '../styles'

export type OwnProps = {
  username: string
  theme?: 'follow' | 'nonFollow' | 'highlight' | 'none'
  style?: Styles.StylesCrossPlatform
  allowFontScaling?: boolean
}

export type Props = {
  onClick?: () => void
} & OwnProps

export default ({username, theme, style, allowFontScaling, onClick}: Props) => (
  <Text
    type="BodySemibold"
    onClick={onClick || undefined}
    className={Styles.classNames({'hover-underline': !Styles.isMobile})}
    style={Styles.collapseStyles([style, styles[theme || 'none'], styles.text])}
    allowFontScaling={allowFontScaling}
  >
    @{username}
  </Text>
)

const styles = Styles.styleSheetCreate({
  follow: {
    backgroundColor: Styles.globalColors.greenLighter,
    borderRadius: 2,
    color: Styles.globalColors.greenDark,
  },
  highlight: {
    backgroundColor: Styles.globalColors.yellow,
    borderRadius: 2,
  },
  nonFollow: {
    backgroundColor: Styles.globalColors.blueLighter2,
    borderRadius: 2,
    color: Styles.globalColors.blueDark,
  },
  none: {
    borderRadius: 2,
  },
  text: Styles.platformStyles({
    common: {
      letterSpacing: 0.3,
      paddingLeft: 2,
      paddingRight: 2,
    },
    isElectron: {
      display: 'inline-block',
    },
  }),
})
