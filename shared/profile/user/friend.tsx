import * as Kb from '@/common-adapters'
import {useFollowerState} from '@/stores/followers'
import {useProfileState} from '@/stores/profile'
import {useUsersState} from '@/stores/users'

type OwnProps = {
  username: string
  width: number
}

const followSizeToStyle = {
  64: {bottom: 0, left: 44, position: 'absolute'} as const,
}

const getFollowIconType = (following: boolean, followsYou: boolean) => {
  if (following === followsYou) {
    return followsYou ? ('icon-mutual-follow-21' as const) : undefined
  }
  return followsYou ? ('icon-follow-me-21' as const) : ('icon-following-21' as const)
}

const Friend = ({username, width}: OwnProps) => {
  const fullname = useUsersState(s => s.infoMap.get(username)?.fullname ?? '')
  const showUserProfile = useProfileState(s => s.dispatch.showUserProfile)
  const following = useFollowerState(s => s.following.has(username))
  const followsYou = useFollowerState(s => s.followers.has(username))
  const followIconType = getFollowIconType(following, followsYou)

  return (
    <Kb.ClickableBox onClick={() => showUserProfile(username)} style={{width}}>
      <Kb.Box2
        direction="vertical"
        style={Kb.Styles.collapseStyles([styles.container, {width}])}
        centerChildren={true}
      >
        <Kb.Avatar size={64} username={username} style={styles.avatar}>
          {!!followIconType && <Kb.ImageIcon type={followIconType} style={followSizeToStyle[64]} />}
        </Kb.Avatar>
        <Kb.ConnectedUsernames
          type={Kb.Styles.isMobile ? 'BodySmallBold' : 'BodyBold'}
          usernames={username}
          onUsernameClicked="profile"
          colorBroken={true}
          colorFollowing={true}
          lineClamp={1}
        />
        <Kb.Text type="BodySmall" lineClamp={1} style={styles.fullname}>
          {fullname}
        </Kb.Text>
      </Kb.Box2>
    </Kb.ClickableBox>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  avatar: {marginBottom: Kb.Styles.globalMargins.xxtiny},
  container: {
    flexShrink: 0,
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
