import * as Kb from '@/common-adapters'
import {useUsersState} from '@/stores/users'
import {useFollowerState} from '@/stores/followers'
import {navToProfile} from '@/constants/router'

type OwnProps = {
  username: string
  width: number
}

const followSizeToStyle = {
  64: {bottom: 0, left: 44, position: 'absolute'} as const,
}

const Friend = (ownProps: OwnProps) => {
  const {username: _username, width} = ownProps
  const _fullname = useUsersState(s => s.infoMap.get(ownProps.username)?.fullname ?? '')
  const fullname = _fullname || ''
  const onClick = () => navToProfile(username)
  const username = _username
  const following = useFollowerState(s => (username ? s.following.has(username) : false))
  const followsYou = useFollowerState(s => (username ? s.followers.has(username) : false))
  const followIconType = followsYou === following
    ? (followsYou ? ('icon-mutual-follow-21' as const) : undefined)
    : followsYou ? ('icon-follow-me-21' as const) : ('icon-following-21' as const)

  return (
    <Kb.ClickableBox
      direction="vertical"
      centerChildren={true}
      noShrink={true}
      style={Kb.Styles.collapseStyles([styles.container, {width: width}])}
      onClick={onClick}
    >
        <Kb.Avatar size={64} username={username} style={styles.avatar}>
          {!!followIconType && <Kb.ImageIcon type={followIconType} style={followSizeToStyle[64]} />}
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
