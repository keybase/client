import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import * as Styles from '@/styles'
import {assertionToDisplay} from '@/common-adapters/usernames'
import {useWindowDimensions} from 'react-native'

export const useBackBadge = () => {
  const visiblePath = C.Router2.getVisiblePath()
  const onTopOfInbox = visiblePath[visiblePath.length - 2]?.name === 'chatRoot'
  const badgeCountsChanged = C.useChatState(s => s.badgeCountsChanged)
  const conversationIDKey = C.useChatContext(s => s.id)
  const badgeNumber = React.useMemo(() => {
    if (!onTopOfInbox) return 0
    const badgeMap = C.useChatState.getState().getBadgeMap(badgeCountsChanged)
    return [...badgeMap.entries()].reduce(
      (res, [currentConvID, currentValue]) =>
        // only show sum of badges that aren't for the current conversation
        currentConvID !== conversationIDKey ? res + currentValue : res,
      0
    )
  }, [badgeCountsChanged, onTopOfInbox, conversationIDKey])
  return badgeNumber
}

const shhIconColor = Styles.globalColors.black_20
const shhIconFontSize = 24

const ShhIcon = React.memo(function ShhIcon() {
  const isMuted = C.useChatContext(s => s.meta.isMuted)
  const mute = C.useChatContext(s => s.dispatch.mute)
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
})

const useMaxWidthStyle = () => {
  const {width} = useWindowDimensions()
  const hasBadge = useBackBadge() > 0
  return React.useMemo(() => ({maxWidth: width - 140 - (hasBadge ? 40 : 0)}), [width, hasBadge])
}

const ChannelHeader = () => {
  const {channelname, smallTeam, teamname, teamID} = C.useChatContext(
    C.useShallow(s => {
      const meta = s.meta
      const {channelname, teamname, teamType, teamID} = meta
      const smallTeam = teamType !== 'big'
      return {channelname, smallTeam, teamID, teamname}
    })
  )
  const textType = smallTeam ? 'BodyBig' : Styles.isMobile ? 'BodyTinySemibold' : 'BodySemibold'
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const onClick = React.useCallback(() => {
    navigateAppend({props: {teamID}, selected: 'team'})
  }, [navigateAppend, teamID])
  const maxWidthStyle = useMaxWidthStyle()

  return (
    <Kb.Box2 direction="vertical" style={maxWidthStyle}>
      <Kb.Box2 direction="horizontal" style={styles.channelHeaderContainer}>
        <Kb.Avatar
          teamname={teamname || undefined}
          size={smallTeam ? 16 : (12 as 16) /* not really allowed a one off */}
        />
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
  const infoMap = C.useUsersState(s => s.infoMap)
  const participantInfo = C.useChatContext(s => s.participants)
  const {participants, theirFullname} = C.useChatContext(
    C.useShallow(s => {
      const meta = s.meta
      const participants = meta.teamname ? emptyArray : participantInfo.name
      const theirFullname =
        participants.length === 2
          ? participants
              .filter(username => username !== you)
              .map(username => infoMap.get(username)?.fullname)[0]
          : undefined
      return {participants, theirFullname}
    })
  )
  const showUserProfile = C.useProfileState(s => s.dispatch.showUserProfile)
  const onShowProfile = React.useCallback(
    (username: string) => {
      showUserProfile(username)
    },
    [showUserProfile]
  )

  const maxWidthStyle = useMaxWidthStyle()

  return (
    <Kb.Box2
      direction={theirFullname ? 'vertical' : 'horizontal'}
      style={Styles.collapseStyles([styles.usernameHeaderContainer, maxWidthStyle])}
    >
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
  const participantInfo = C.useChatContext(s => s.participants)
  const meta = C.useChatContext(s => s.meta)
  const participants = (meta.teamname ? null : participantInfo.name) || emptyArray
  const phoneOrEmail = participants.find(s => s.endsWith('@phone') || s.endsWith('@email')) || ''
  const formattedPhoneOrEmail = assertionToDisplay(phoneOrEmail)
  const name = participantInfo.contactName.get(phoneOrEmail)
  const maxWidthStyle = useMaxWidthStyle()
  return (
    <Kb.Box2
      direction="vertical"
      style={Styles.collapseStyles([styles.usernameHeaderContainer, maxWidthStyle])}
    >
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
