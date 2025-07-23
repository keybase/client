import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import type {HeaderBackButtonProps} from '@react-navigation/elements'
import {HeaderLeftArrow} from '@/common-adapters/header-hoc'
import {Keyboard} from 'react-native'
import {getRouteParamsFromRoute} from '@/router-v2/route-params'
// import {DebugChatDumpContext} from '@/constants/chat2/debug'
import * as Styles from '@/styles'
import {assertionToDisplay} from '@/common-adapters/usernames'
import {useWindowDimensions} from 'react-native'

export const HeaderAreaRight = () => {
  const conversationIDKey = C.useChatContext(s => s.id)
  const pendingWaiting =
    conversationIDKey === C.Chat.pendingWaitingConversationIDKey ||
    conversationIDKey === C.Chat.pendingErrorConversationIDKey

  // const {chatDebugDump} = React.useContext(DebugChatDumpContext)
  // const [showToast, setShowToast] = React.useState(false)
  // const dumpIcon = chatDebugDump ? (
  //   <>
  //     <Kb.SimpleToast iconType="iconfont-check" text="Logged, send feedback next" visible={showToast} />
  //     <Kb.Icon
  //       type="iconfont-keybase"
  //       onClick={() => {
  //         chatDebugDump(conversationIDKey)
  //         setShowToast(true)
  //         setTimeout(() => {
  //           setShowToast(false)
  //         }, 2000)
  //       }}
  //       style={{zIndex: 999}}
  //     />
  //   </>
  // ) : null

  const showInfoPanel = C.useChatContext(s => s.dispatch.showInfoPanel)
  const onShowInfoPanel = React.useCallback(() => showInfoPanel(true, undefined), [showInfoPanel])
  const toggleThreadSearch = C.useChatContext(s => s.dispatch.toggleThreadSearch)
  const onToggleThreadSearch = React.useCallback(() => {
    // fix a race with the keyboard going away and coming back quickly
    Keyboard.dismiss()
    setTimeout(() => {
      toggleThreadSearch()
    }, 100)
  }, [toggleThreadSearch])

  return (
    <Kb.Box2
      direction="horizontal"
      gap="small"
      style={Kb.Styles.collapseStyles([styles.headerRight, {opacity: pendingWaiting ? 0 : 1}])}
    >
      <Kb.Icon type="iconfont-search" onClick={onToggleThreadSearch} />
      <Kb.Icon type="iconfont-info" onClick={onShowInfoPanel} />
    </Kb.Box2>
  )
}

enum HeaderType {
  Team,
  PhoneEmail,
  User,
}

const HeaderBranchContainer = React.memo(function HeaderBranchContainer() {
  const participantInfo = C.useChatContext(s => s.participants)
  const type = C.useChatContext(s => {
    const meta = s.meta
    const teamName = meta.teamname
    if (teamName) {
      return HeaderType.Team
    }
    const participants = participantInfo.name
    const isPhoneOrEmail = participants.some(
      participant => participant.endsWith('@phone') || participant.endsWith('@email')
    )
    return isPhoneOrEmail ? HeaderType.PhoneEmail : HeaderType.User
  })

  switch (type) {
    case HeaderType.Team:
      return <ChannelHeader />
    case HeaderType.PhoneEmail:
      return <PhoneOrEmailHeader />
    case HeaderType.User:
      return <UsernameHeader />
  }
})
export default HeaderBranchContainer

const BadgeHeaderLeftArray = (p: HeaderBackButtonProps) => {
  const badgeNumber = useBackBadge()
  return <HeaderLeftArrow badgeNumber={badgeNumber} {...p} />
}

export const headerNavigationOptions = (route: unknown) => {
  const conversationIDKey =
    getRouteParamsFromRoute<'chatConversation'>(route)?.conversationIDKey ?? C.Chat.noConversationIDKey
  return {
    headerLeft: (props: HeaderBackButtonProps) => {
      const {onLabelLayout, labelStyle, ...rest} = props
      return (
        <C.ChatProvider id={conversationIDKey}>
          <BadgeHeaderLeftArray {...rest} />
        </C.ChatProvider>
      )
    },
    headerRight: () => (
      <C.ChatProvider id={conversationIDKey}>
        <HeaderAreaRight />
      </C.ChatProvider>
    ),
    headerTitle: () => (
      <C.ChatProvider id={conversationIDKey}>
        <HeaderBranchContainer />
      </C.ChatProvider>
    ),
  }
}

export const useBackBadge = () => {
  const visiblePath = C.Router2.getVisiblePath()
  const onTopOfInbox = visiblePath[visiblePath.length - 2]?.name === 'chatRoot'
  const conversationIDKey = C.useChatContext(s => s.id)
  const badgeNumber = C.useChatState(s => s.getBackCount(conversationIDKey))
  if (!onTopOfInbox) return 0
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
  const w = width - 140 - (hasBadge ? 40 : 0)
  return React.useMemo(() => ({maxWidth: w, minWidth: w}), [w])
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
      headerRight: {
        flexShrink: 0,
        height: 22,
        width: 56,
      },
      lessMargins: {marginBottom: -5},
      nameMutedContainer: {
        alignItems: 'center',
        justifyContent: 'center',
      },
      shhIcon: {marginLeft: Styles.globalMargins.xtiny},
      usernameHeaderContainer: {alignItems: 'center', justifyContent: 'center'},
    }) as const
)
