import {useProfileState} from '@/stores/profile'
import * as Kb from '@/common-adapters'
import {useUsersState} from '@/stores/users'

type OwnProps = {
  username: string
  width: number
}

const Container = (ownProps: OwnProps) => {
  const {username: _username, width} = ownProps
  const _fullname = useUsersState(s => s.infoMap.get(ownProps.username)?.fullname ?? '')
  const showUserProfile = useProfileState(s => s.dispatch.showUserProfile)
  const _onClick = showUserProfile
  const fullname = _fullname || ''
  const onClick = () => _onClick(username)
  const username = _username

  return (
    <Kb.ClickableBox onClick={onClick} style={{width: width}}>
      <Kb.Box2
        direction="vertical"
        style={Kb.Styles.collapseStyles([styles.container, {width: width}])}
        centerChildren={true}
      >
        <Kb.Avatar size={64} username={username} style={styles.avatar} showFollowingStatus={true} />
        <Kb.ConnectedUsernames
          type={Kb.Styles.isMobile ? 'BodySmallBold' : 'BodyBold'}
          usernames={username}
          onUsernameClicked="profile"
          colorBroken={true}
          colorFollowing={true}
          lineClamp={1}
        />
        <Kb.Text2 type="BodySmall" lineClamp={1} style={styles.fullname}>
          {fullname}
        </Kb.Text2>
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
    isMobile: {backgroundColor: Kb.Styles.globalColors.fastBlank},
  }),
}))

export default Container
