import * as Chat from '@/stores/chat2'
import * as Styles from '@/styles'
import {WithProfileCardPopup} from './profile-card'
import Text from './text'

export type OwnProps = {
  allowFontScaling?: boolean
  username: string
  theme?: 'follow' | 'nonFollow' | 'highlight' | 'none'
  style?: Styles.StylesCrossPlatform
}

export type Props = {
  onClick?: () => void
} & OwnProps
const Mention = ({allowFontScaling, username, theme, style, onClick}: Props) => {
  const renderText = (onLongPress?: () => void) => (
    <Text
      type="BodyBold"
      allowFontScaling={allowFontScaling}
      onClick={onClick || undefined}
      className={Styles.classNames({'hover-underline': !Styles.isMobile})}
      style={Styles.collapseStyles([style, styles[theme || 'none'], styles.text])}
      onLongPress={onLongPress}
    >
      @{username}
    </Text>
  )
  return Chat.isSpecialMention(username) ? (
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
