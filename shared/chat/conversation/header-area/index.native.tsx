import * as C from '../../../constants'
import * as Constants from '../../../constants/chat2'
import * as Kb from '../../../common-adapters'
import * as React from 'react'
import * as Styles from '../../../styles'
import * as UsersConstants from '../../../constants/users'
import shallowEqual from 'shallowequal'
import {assertionToDisplay} from '../../../common-adapters/usernames'

const shhIconColor = Styles.globalColors.black_20
const shhIconFontSize = 24

const ShhIcon = () => {
  const isMuted = Constants.useContext(s => s.meta.isMuted)
  const mute = Constants.useContext(s => s.dispatch.mute)
  const unMuteConversation = React.useCallback(() => {
    mute(false)
  }, [mute])
  return isMuted ? (
    <Kb.Icon
      type="iconfont-shh"
      style={styles.shhIcon}
      color={shhIconColor}
      fontSize={shhIconFontSize}
      onClick={unMuteConversation}
    />
  ) : null
}

const ChannelHeader = () => {
  const {channelname, smallTeam, teamname, teamID} = Constants.useContext(s => {
    const meta = s.meta
    const {channelname, teamname, teamType, teamID} = meta
    const smallTeam = teamType !== 'big'
    return {channelname, smallTeam, teamID, teamname}
  }, shallowEqual)
  const textType = smallTeam ? 'BodyBig' : Styles.isMobile ? 'BodyTinySemibold' : 'BodySemibold'
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const onClick = React.useCallback(() => {
    navigateAppend({props: {teamID}, selected: 'team'})
  }, [navigateAppend, teamID])

  return (
    <Kb.Box2 direction="vertical">
      <Kb.Box2 direction="horizontal" style={styles.channelHeaderContainer}>
        <Kb.Avatar teamname={teamname || undefined} size={smallTeam ? 16 : (12 as any)} />
        <Kb.Text
          type={textType}
          lineClamp={1}
          ellipsizeMode="middle"
          onClick={onClick}
          style={Styles.collapseStyles([styles.channelName, !smallTeam && styles.channelNameLight])}
        >
          &nbsp;
          {teamname}
        </Kb.Text>
        {smallTeam && <ShhIcon />}
      </Kb.Box2>
      {!smallTeam && (
        <Kb.Box2 direction="horizontal" style={styles.channelHeaderContainer}>
          <Kb.Text type="BodyBig" style={styles.channelName} lineClamp={1} ellipsizeMode="tail">
            #{channelname}
          </Kb.Text>
          <ShhIcon />
        </Kb.Box2>
      )}
    </Kb.Box2>
  )
}

const emptyArray = new Array<string>()
const UsernameHeader = () => {
  const you = C.useCurrentUserState(s => s.username)
  const infoMap = UsersConstants.useState(s => s.infoMap)
  const participantInfo = Constants.useContext(s => s.participants)
  const {participants, theirFullname} = Constants.useContext(s => {
    const meta = s.meta
    const participants = meta.teamname ? emptyArray : participantInfo.name
    const theirFullname =
      participants.length === 2
        ? participants
            .filter(username => username !== you)
            .map(username => infoMap.get(username)?.fullname)[0]
        : undefined

    return {participants, theirFullname}
  }, shallowEqual)
  const showUserProfile = C.useProfileState(s => s.dispatch.showUserProfile)
  const onShowProfile = React.useCallback(
    (username: string) => {
      showUserProfile(username)
    },
    [showUserProfile]
  )

  return (
    <Kb.Box2 direction={theirFullname ? 'vertical' : 'horizontal'} style={styles.usernameHeaderContainer}>
      {!!theirFullname && (
        <Kb.Text lineClamp={1} type="BodyBig" fixOverdraw={true}>
          {theirFullname}
        </Kb.Text>
      )}
      <Kb.Box2 direction="horizontal" style={styles.nameMutedContainer}>
        <Kb.ConnectedUsernames
          colorFollowing={true}
          inline={false}
          lineClamp={participants.length > 2 ? 2 : 1}
          commaColor={Styles.globalColors.black_50}
          type={participants.length > 2 || !!theirFullname ? 'BodyTinyBold' : 'BodyBig'}
          usernames={participants}
          containerStyle={styles.center}
          onUsernameClicked={onShowProfile}
          skipSelf={participants.length > 1}
        />
        <ShhIcon />
      </Kb.Box2>
    </Kb.Box2>
  )
}

const PhoneOrEmailHeader = () => {
  const participantInfo = Constants.useContext(s => s.participants)
  const meta = Constants.useContext(s => s.meta)
  const participants = (meta.teamname ? null : participantInfo.name) || emptyArray
  const phoneOrEmail = participants.find(s => s.endsWith('@phone') || s.endsWith('@email')) || ''
  const formattedPhoneOrEmail = assertionToDisplay(phoneOrEmail)
  const name = participantInfo.contactName.get(phoneOrEmail)
  return (
    <Kb.Box2 direction="vertical" style={styles.usernameHeaderContainer}>
      <Kb.Box2 direction="horizontal" style={styles.lessMargins}>
        <Kb.Text type="BodyBig" lineClamp={1} ellipsizeMode="middle">
          {formattedPhoneOrEmail}
        </Kb.Text>
        <ShhIcon />
      </Kb.Box2>
      {!!name && <Kb.Text type="BodyTiny">{name}</Kb.Text>}
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      center: {
        backgroundColor: Styles.globalColors.fastBlank,
        justifyContent: 'center',
        textAlign: 'center',
      },
      channelHeaderContainer: {
        alignItems: 'center',
        alignSelf: 'center',
        paddingLeft: Styles.globalMargins.tiny,
        paddingRight: Styles.globalMargins.tiny,
      },
      channelName: {color: Styles.globalColors.black},
      channelNameLight: {color: Styles.globalColors.black_50},
      lessMargins: {marginBottom: -5},
      nameMutedContainer: {
        alignItems: 'center',
        justifyContent: 'center',
      },
      shhIcon: {marginLeft: Styles.globalMargins.xtiny},
      usernameHeaderContainer: {alignItems: 'center', justifyContent: 'center'},
    }) as const
)

export {ChannelHeader, PhoneOrEmailHeader, UsernameHeader}
