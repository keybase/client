import * as Kb from '@/common-adapters'
import {useUsersState} from '@/stores/users'
import {useFollowerState} from '@/stores/followers'
import {navToProfile} from '@/constants/router'

type OwnProps = {
  username: string
  width: number
}

const followIconStyle = {bottom: 0, left: 44, position: 'absolute'} as const

const Friend = (ownProps: OwnProps) => {
  const {username, width} = ownProps
  const fullname = useUsersState(s => s.infoMap.get(ownProps.username)?.fullname ?? '')
  const onClick = () => navToProfile(username)
  const following = useFollowerState(s => s.following.has(username))
  const followsYou = useFollowerState(s => s.followers.has(username))
  const followIconType =
    followsYou && following
      ? ('icon-mutual-follow-21' as const)
      : followsYou
        ? ('icon-follow-me-21' as const)
        : following
          ? ('icon-following-21' as const)
          : undefined

  return (
    <Kb.ClickableBox
      direction="vertical"
      centerChildren={true}
      noShrink={true}
      style={Kb.Styles.collapseStyles([styles.container, {width: width}])}
      onClick={onClick}
    >
        <Kb.Avatar size={64} username={username} style={styles.avatar}>
          {!!followIconType && <Kb.ImageIcon type={followIconType} style={followIconStyle} />}
        </Kb.Avatar>
        <Kb.ConnectedUsernames
          type={isMobile ? 'BodySmallBold' : 'BodyBold'}
          usernames={username}
          onUsernameClicked="profile"
          colorBroken={true}
          colorFollowing={true}
          lineClamp={1}
        />
        <Kb.Text type="BodySmall" lineClamp={1} style={styles.fullname}>
          {fullname}
        </Kb.Text>
    </Kb.ClickableBox>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  avatar: {marginBottom: Kb.Styles.globalMargins.xxtiny},
  container: {
    height: 105,
    justifyContent: 'flex-start',
    minWidth: 0,
  },
  fullname: Kb.Styles.platformStyles({
    isElectron: {
      textAlign: 'center',
      width: 80,
      wordBreak: 'break-all',
    },
  }),
}))

export default Friend
