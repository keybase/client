import * as C from '@/constants'
import * as Chat from '@/stores/chat'
import {chatStores} from '@/stores/convo-registry'
import * as ConvoState from '@/stores/convostate'
import {getConvoState} from '@/stores/convostate'
import * as Kb from '@/common-adapters'
import type {HeaderBackButtonProps} from '@react-navigation/elements'
import {HeaderLeftButton} from '@/common-adapters/header-buttons'
import {Keyboard} from 'react-native'
import type {SFSymbol} from 'sf-symbols-typescript'
// import {DebugChatDumpContext} from '@/constants/chat/debug'
import {assertionToDisplay} from '@/common-adapters/usernames'
import {useSafeAreaFrame} from 'react-native-safe-area-context'
import {useUsersState} from '@/stores/users'
import {useCurrentUserState} from '@/stores/current-user'
import {navToProfile} from '@/constants/router'
import * as React from 'react'

export const HeaderAreaRight = () => {
  const conversationIDKey = ConvoState.useChatContext(s => s.id)
  const pendingWaiting =
    conversationIDKey === Chat.pendingWaitingConversationIDKey ||
    conversationIDKey === Chat.pendingErrorConversationIDKey

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

  const showInfoPanel = ConvoState.useChatContext(s => s.dispatch.showInfoPanel)
  const onShowInfoPanel = () => showInfoPanel(true, undefined)
  const toggleThreadSearch = ConvoState.useChatContext(s => s.dispatch.toggleThreadSearch)
  const onToggleThreadSearch = () => {
    // fix a race with the keyboard going away and coming back quickly
    Keyboard.dismiss()
    setTimeout(() => {
      toggleThreadSearch()
    }, 100)
  }

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

const HeaderBranchContainer = function HeaderBranchContainer() {
  const participantInfo = ConvoState.useChatContext(s => s.participants)
  const type = ConvoState.useChatContext(s => {
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
}
export default HeaderBranchContainer

const BadgeHeaderLeftArray = (p: HeaderBackButtonProps) => {
  const badgeNumber = useBackBadge()
  return <HeaderLeftButton badgeNumber={badgeNumber} {...p} />
}

const sfIcon = (name: SFSymbol) => ({name, type: 'sfSymbol' as const})

export const headerNavigationOptions = (route: {params?: {conversationIDKey?: string}}) => {
  const conversationIDKey = route.params?.conversationIDKey ?? Chat.noConversationIDKey
  return {
    // iOS 26: headerLeft omitted — native back button comes from tabStackOptions (headerBackVisible: true).
    // BadgeHeaderUpdater in container.tsx drives unstable_headerLeftItems for the badge count.
    ...(!Kb.Styles.isIOS
      ? {
          headerLeft: (props: HeaderBackButtonProps) => {
            const {labelStyle, ...rest} = props
            return (
              <ConvoState.ChatProvider id={conversationIDKey}>
                <BadgeHeaderLeftArray {...rest} />
              </ConvoState.ChatProvider>
            )
          },
        }
      : {}),
    // iOS 26: two separate native buttons (each gets its own glass pill).
    // getConvoState lets us access dispatch without hooks since this runs outside React.
    ...(Kb.Styles.isIOS
      ? {
          unstable_headerRightItems: () => [
            {
              icon: sfIcon('magnifyingglass'),
              label: 'Search',
              onPress: () => {
                Keyboard.dismiss()
                setTimeout(() => getConvoState(conversationIDKey).dispatch.toggleThreadSearch(), 100)
              },
              type: 'button' as const,
            },
            {
              icon: sfIcon('info.circle'),
              label: 'Info',
              onPress: () => getConvoState(conversationIDKey).dispatch.showInfoPanel(true, undefined),
              type: 'button' as const,
            },
          ],
        }
      : {
          headerRight: () => (
            <ConvoState.ChatProvider id={conversationIDKey}>
              <HeaderAreaRight />
            </ConvoState.ChatProvider>
          ),
        }),
    headerTitle: () => (
      <ConvoState.ChatProvider id={conversationIDKey}>
        <HeaderBranchContainer />
      </ConvoState.ChatProvider>
    ),
  }
}

export const useBackBadge = () => {
  const visiblePath = C.Router2.getVisiblePath()
  const onTopOfInbox = visiblePath[visiblePath.length - 2]?.name === 'chatRoot'
  const conversationIDKey = ConvoState.useChatContext(s => s.id)
  const badgeStateVersion = Chat.useChatState(s => s.badgeStateVersion)
  const badgeNumber = React.useMemo(() => {
    void badgeStateVersion
    let count = 0
    for (const store of chatStores.values()) {
      const {badge, id} = store.getState()
      if (id !== conversationIDKey) {
        count += badge
      }
    }
    return count
  }, [badgeStateVersion, conversationIDKey])
  if (!onTopOfInbox) return 0
  return badgeNumber
}

const shhIconColor = Kb.Styles.globalColors.black_20
const shhIconFontSize = 24

const ShhIcon = function ShhIcon() {
  const isMuted = ConvoState.useChatContext(s => s.meta.isMuted)
  const mute = ConvoState.useChatContext(s => s.dispatch.mute)
  const unMuteConversation = () => {
    mute(false)
  }
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

const useMaxWidthStyle = () => {
  const {width} = useSafeAreaFrame()
  const hasBadge = useBackBadge() > 0
  const w = width - 140 - (hasBadge ? 40 : 0)
  return {maxWidth: w, minWidth: w}
}

const ChannelHeader = () => {
  const {channelname, smallTeam, teamname, teamID} = ConvoState.useChatContext(
    C.useShallow(s => {
      const meta = s.meta
      const {channelname, teamname, teamType, teamID} = meta
      const smallTeam = teamType !== 'big'
      return {channelname, smallTeam, teamID, teamname}
    })
  )
  const textType = smallTeam ? 'BodyBig' : Kb.Styles.isMobile ? 'BodyTinySemibold' : 'BodySemibold'
  const navigateAppend = C.Router2.navigateAppend
  const onClick = () => {
    navigateAppend({name: 'team', params: {teamID}})
  }
  const maxWidthStyle = useMaxWidthStyle()

  return (
    <Kb.Box2 direction="vertical" style={maxWidthStyle}>
      <Kb.Box2 direction="horizontal" style={styles.channelHeaderContainer}>
        <Kb.Avatar {...(teamname ? {teamname} : {})} size={16} />
        <Kb.Text
          type={textType}
          lineClamp={1}
          ellipsizeMode="middle"
          onClick={onClick}
          style={Kb.Styles.collapseStyles([styles.channelName, !smallTeam && styles.channelNameLight])}
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
  const you = useCurrentUserState(s => s.username)
  const infoMap = useUsersState(s => s.infoMap)
  const participantInfo = ConvoState.useChatContext(s => s.participants)
  const {participants, theirFullname} = ConvoState.useChatContext(
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
  const onShowProfile = (username: string) => {
    navToProfile(username)
  }

  const maxWidthStyle = useMaxWidthStyle()

  return (
    <Kb.Box2
      direction={theirFullname ? 'vertical' : 'horizontal'}
      style={Kb.Styles.collapseStyles([styles.usernameHeaderContainer, maxWidthStyle])}
    >
      {!!theirFullname && (
        <Kb.Text lineClamp={1} type="BodyBig">
          {theirFullname}
        </Kb.Text>
      )}
      <Kb.Box2 direction="horizontal" style={styles.nameMutedContainer} justifyContent="center">
        <Kb.ConnectedUsernames
          colorFollowing={true}
          inline={false}
          lineClamp={participants.length > 2 ? 2 : 1}
          commaColor={Kb.Styles.globalColors.black_50}
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
  const participantInfo = ConvoState.useChatContext(s => s.participants)
  const meta = ConvoState.useChatContext(s => s.meta)
  const participants = (meta.teamname ? null : participantInfo.name) || emptyArray
  const phoneOrEmail = participants.find(s => s.endsWith('@phone') || s.endsWith('@email')) || ''
  const formattedPhoneOrEmail = assertionToDisplay(phoneOrEmail)
  const name = participantInfo.contactName.get(phoneOrEmail)
  const maxWidthStyle = useMaxWidthStyle()
  return (
    <Kb.Box2
      direction="vertical"
      style={Kb.Styles.collapseStyles([styles.usernameHeaderContainer, maxWidthStyle])}
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

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      center: {
        justifyContent: 'center',
        textAlign: 'center',
      },
      channelHeaderContainer: {
        alignItems: 'center',
        alignSelf: 'center',
        paddingLeft: Kb.Styles.globalMargins.tiny,
        paddingRight: Kb.Styles.globalMargins.tiny,
      },
      channelName: {color: Kb.Styles.globalColors.black},
      channelNameLight: {color: Kb.Styles.globalColors.black_50},
      headerRight: {
        flexShrink: 0,
        height: 22,
        width: 56,
      },
      lessMargins: {marginBottom: -5},
      nameMutedContainer: {
        alignItems: 'center',
      },
      shhIcon: {marginLeft: Kb.Styles.globalMargins.xtiny},
      usernameHeaderContainer: {alignItems: 'center', justifyContent: 'center'},
    }) as const
)
