import * as Chat from '@/constants/chat'
import * as Styles from '@/styles'
import {WithProfileCardPopup} from './profile-card'
import Text from './text'
import {useFollowerState} from '@/stores/followers'
import {useCurrentUserState} from '@/stores/current-user'
import {navToProfile} from '@/constants/router'

export type OwnProps = {
  username: string
  style?: Styles.StylesCrossPlatform
  allowFontScaling?: boolean
}

const Mention = (ownProps: OwnProps) => {
  const styles = useStyles()
  const {style, allowFontScaling} = ownProps
  const username = ownProps.username.toLowerCase()
  const following = useFollowerState(s => s.following.has(username))
  const myUsername = useCurrentUserState(s => s.username)
  const isSpecial = Chat.isSpecialMention(username)
  const theme = isSpecial || myUsername === username ? 'highlight' : following ? 'follow' : 'nonFollow'
  const onClick = isSpecial ? undefined : () => navToProfile(username)

  const renderText = (onLongPress?: () => void) => (
    <Text
      type="BodyBold"
      onClick={onClick || undefined}
      className={Styles.classNames({'hover-underline': !isMobile})}
      style={Styles.collapseStyles([style, styles[theme], styles.text])}
      allowFontScaling={allowFontScaling}
      onLongPress={onLongPress}
    >
      @{username}
    </Text>
  )
  return isSpecial ? (
    renderText()
  ) : (
    <WithProfileCardPopup username={username}>{renderText}</WithProfileCardPopup>
  )
}
export default Mention

const useStyles = Styles.createStyleHook(theme => ({
  follow: {
    backgroundColor: theme.greenLighterOrGreen,
    color: theme.greenDarkOrBlack,
  },
  highlight: {
    backgroundColor: theme.yellowOrYellowAlt,
    color: theme.blackOrBlack,
  },
  nonFollow: {
    backgroundColor: theme.blueLighter2,
    color: theme.blueDark,
  },
  text: Styles.platformStyles({
    common: {
      borderRadius: 2,
      letterSpacing: 0.3,
      ...Styles.paddingH(2),
    },
    isElectron: {
      display: 'inline-block',
    },
  }),
}))
