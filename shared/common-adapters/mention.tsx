import Text from './text'
import * as Styles from '../styles'
import {WithProfileCardPopup} from './profile-card'
import {isSpecialMention} from '../constants/chat2'

export type OwnProps = {
  username: string
  theme?: 'follow' | 'nonFollow' | 'highlight' | 'none'
  style?: Styles.StylesCrossPlatform
  allowFontScaling?: boolean
}

export type Props = {
  onClick?: () => void
} & OwnProps
const Mention = ({username, theme, style, allowFontScaling, onClick}: Props) => {
  const renderText = (onLongPress?: () => void) => (
    <Text
      type="BodyBold"
      onClick={onClick || undefined}
      className={Styles.classNames({'hover-underline': !Styles.isMobile})}
      style={Styles.collapseStyles([style, styles[theme || 'none'], styles.text])}
      allowFontScaling={allowFontScaling}
      onLongPress={onLongPress}
    >
      @{username}
    </Text>
  )
  return isSpecialMention(username) ? (
    renderText()
  ) : (
    <WithProfileCardPopup username={username}>{renderText}</WithProfileCardPopup>
  )
}
export default Mention

const styles = Styles.styleSheetCreate(() => ({
  follow: {
    backgroundColor: Styles.globalColors.greenLighterOrGreen,
    borderRadius: 2,
    color: Styles.globalColors.greenDarkOrBlack,
  },
  highlight: {
    backgroundColor: Styles.globalColors.yellowOrYellowAlt,
    borderRadius: 2,
    color: Styles.globalColors.blackOrBlack,
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
}))
