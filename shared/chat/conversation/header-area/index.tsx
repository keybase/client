import * as C from '@/constants'
import * as Chat from '@/constants/chat'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import * as T from '@/constants/types'
import type {HeaderBackButtonProps} from '@react-navigation/elements'
import {useNavigation} from '@react-navigation/native'
import {HeaderLeftButton} from '@/common-adapters/header-buttons'
import {Keyboard, Platform} from 'react-native'
import {useSafeAreaFrame} from 'react-native-safe-area-context'
import type {SFSymbol} from 'sf-symbols-typescript'
// import {DebugChatDumpContext} from '@/constants/chat/debug'
import {assertionToDisplay} from '@/common-adapters/usernames'
import {useUsersState} from '@/stores/users'
import {useCurrentUserState} from '@/stores/current-user'
import {useConfigState} from '@/stores/config'
import {navToProfile} from '@/constants/router'
import * as TestIDs from '@/tests/e2e/shared/test-ids'
import {showConversationInfoPanel, toggleConversationThreadSearch} from '../thread-context'
import {useConversationMetadata} from '../data-hooks'
import {muteConversation} from '../status-actions'

type HeaderConversationProps = {conversationIDKey: T.Chat.ConversationIDKey}

const HeaderAreaRight = (props: HeaderConversationProps) => {
  const {conversationIDKey} = props
  const pendingWaiting =
    conversationIDKey === Chat.pendingWaitingConversationIDKey ||
    conversationIDKey === Chat.pendingErrorConversationIDKey

  const onShowInfoPanel = () => {
    Keyboard.dismiss()
    setTimeout(() => {
      showConversationInfoPanel(conversationIDKey, true, undefined)
    }, 100)
  }
  const onToggleThreadSearch = () => {
    Keyboard.dismiss()
    setTimeout(() => {
      toggleConversationThreadSearch(conversationIDKey)
    }, 100)
  }

  return (
    <Kb.Box2
      direction="horizontal"
      gap="small"
      noShrink={true}
      style={Kb.Styles.collapseStyles([styles.headerRight, {opacity: pendingWaiting ? 0 : 1}])}
    >
      <Kb.Icon type="iconfont-search" onClick={onToggleThreadSearch} />
      <Kb.Icon type="iconfont-info" onClick={onShowInfoPanel} testID={TestIDs.CHAT_HEADER_INFO_BUTTON} />
    </Kb.Box2>
  )
}
enum HeaderType {
  Team,
  PhoneEmail,
  User,
}

const HeaderBranchContainerInner = function HeaderBranchContainerInner(props: HeaderConversationProps) {
  const {conversationIDKey} = props
  const {meta, participants: participantInfo} = useConversationMetadata(conversationIDKey)
  const type = (() => {
    const teamName = meta.teamname
    if (teamName) {
      return HeaderType.Team
    }
    const participants = participantInfo.name
    const isPhoneOrEmail = participants.some(
      participant => participant.endsWith('@phone') || participant.endsWith('@email')
    )
    return isPhoneOrEmail ? HeaderType.PhoneEmail : HeaderType.User
  })()

  switch (type) {
    case HeaderType.Team:
      return <ChannelHeader conversationIDKey={conversationIDKey} />
    case HeaderType.PhoneEmail:
      return <PhoneOrEmailHeader conversationIDKey={conversationIDKey} />
    case HeaderType.User:
      return <UsernameHeader conversationIDKey={conversationIDKey} />
  }
}

const BadgeHeaderLeftArray = (p: HeaderBackButtonProps & HeaderConversationProps) => {
  const {conversationIDKey, ...rest} = p
  const badgeNumber = useBackBadge(conversationIDKey)
  return <HeaderLeftButton badgeNumber={badgeNumber} {...rest} />
}

const sfIcon = (name: SFSymbol) => ({name, type: 'sfSymbol' as const})

export const headerNavigationOptions = (route: {params?: {conversationIDKey?: T.Chat.ConversationIDKey}}) => {
  if (!isMobile) return {}
  const conversationIDKey = route.params?.conversationIDKey ?? Chat.noConversationIDKey
  return {
    // iOS 26: headerLeft omitted — the native back button is used by default. When unreads exist
    // elsewhere, BadgeHeaderUpdater (mounted in container.tsx) swaps it for a custom back button
    // carrying the badge via setOptions (headerBackVisible: false + unstable_headerLeftItems).
    ...(!isIOS
      ? {
          headerBackVisible: false,
          headerLeft: (props: HeaderBackButtonProps) => {
            const {labelStyle, ...rest} = props
            return <BadgeHeaderLeftArray {...rest} conversationIDKey={conversationIDKey} />
          },
        }
      : {headerBackVisible: true}),
    // iOS 26: single overflow menu (one glass pill) housing search + info actions.
    ...(isIOS
      ? {
          unstable_headerRightItems: () => [
            {
              icon: sfIcon('ellipsis'),
              label: 'More',
              menu: {
                items: [
                  {
                    icon: sfIcon('magnifyingglass'),
                    label: 'Search',
                    onPress: () => {
                      Keyboard.dismiss()
                      setTimeout(() => toggleConversationThreadSearch(conversationIDKey), 100)
                    },
                    type: 'action' as const,
                  },
                  {
                    icon: sfIcon('info.circle'),
                    label: 'Info',
                    onPress: () => {
                      Keyboard.dismiss()
                      setTimeout(() => {
                        showConversationInfoPanel(conversationIDKey, true, undefined)
                      }, 100)
                    },
                    type: 'action' as const,
                  },
                ],
              },
              type: 'menu' as const,
            },
          ],
        }
      : {
          headerRight: () => <HeaderAreaRight conversationIDKey={conversationIDKey} />,
        }),
    headerTitle: () => <HeaderBranchContainerInner conversationIDKey={conversationIDKey} />,
  }
}

const useBackBadge = (conversationIDKey: T.Chat.ConversationIDKey) => {
  const visiblePath = C.Router2.getVisiblePath()
  const onTopOfInbox = visiblePath[visiblePath.length - 2]?.name === 'chatRoot'
  const badgeState = useConfigState(s => s.badgeState)
  const badgeNumber =
    badgeState?.conversations?.reduce((count, conversation) => {
      const id = T.Chat.conversationIDToKey(conversation.convID)
      return id === conversationIDKey ? count : count + conversation.badgeCount
    }, 0) ?? 0
  if (!onTopOfInbox) return 0
  return badgeNumber
}

// UIBarButtonItem.badge (and the glass pill bar items) need iOS 26.
const isIOS26Plus = isIOS && parseInt(Platform.Version as string, 10) >= 26

// iOS only: screen options functions aren't reactive to store state, so a mounted null
// component pushes the unread badge into the header via setOptions as badge counts change.
// While badged we swap the native back button for a bar button item (SFSymbol chevron) carrying
// a native UIBarButtonItem badge (iOS 26+), so the glass pill look is preserved. Pre-26 has no
// bar item badge, so we fall back to our own back button (arrow + badge as one pressable, same
// as the Android header).
// Android renders the badge through headerLeft (BadgeHeaderLeftArray) instead.
export const BadgeHeaderUpdater = isIOS
  ? function BadgeHeaderUpdater(props: HeaderConversationProps) {
      const {conversationIDKey} = props
      const badgeNumber = useBackBadge(conversationIDKey)
      const navigation = useNavigation()
      React.useEffect(() => {
        navigation.setOptions(
          badgeNumber > 0
            ? {
                headerBackVisible: false,
                unstable_headerLeftItems: () => [
                  isIOS26Plus
                    ? {
                        badge: {
                          style: {
                            backgroundColor: Kb.Styles.globalColors.orange,
                            color: Kb.Styles.globalColors.white,
                          },
                          value: badgeNumber,
                        },
                        icon: sfIcon('chevron.backward'),
                        label: 'Back',
                        onPress: () => navigation.goBack(),
                        type: 'button' as const,
                      }
                    : {
                        element: <Kb.BackButton badgeNumber={badgeNumber} style={styles.iosBackBadgeButton} />,
                        type: 'custom' as const,
                      },
                ],
              }
            : {headerBackVisible: true, unstable_headerLeftItems: undefined}
        )
      }, [navigation, badgeNumber])
      return null
    }
  : (_props: HeaderConversationProps) => null

const shhIconColor = Kb.Styles.globalColors.black_20
const shhIconFontSize = 24

const ShhIcon = function ShhIcon(props: HeaderConversationProps) {
  const {conversationIDKey} = props
  const isMuted = useConversationMetadata(conversationIDKey).meta.isMuted
  const unMuteConversation = () => {
    muteConversation(conversationIDKey, false)
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

// iOS never renders the back badge (native back button, no headerLeft), so don't subscribe to
// badge state there — width reacting to other conversations' badges makes the title reflow live.
const useHeaderBadge = isIOS ? () => 0 : useBackBadge

// maxWidth only, no minWidth: a fixed-width title view can't be centered by the native header
// when the left/right items don't match the reserved space, which shifts the title off-center.
const useMaxWidthStyle = (conversationIDKey: T.Chat.ConversationIDKey) => {
  const {width} = useSafeAreaFrame()
  const hasBadge = useHeaderBadge(conversationIDKey) > 0
  return {maxWidth: width - 140 - (hasBadge ? 40 : 0)}
}

const ChannelHeader = (props: HeaderConversationProps) => {
  const {conversationIDKey} = props
  const {channelname, teamname, teamType, teamID} = useConversationMetadata(conversationIDKey).meta
  const smallTeam = teamType !== 'big'
  const textType = smallTeam ? 'BodyBig' : isMobile ? 'BodyTinySemibold' : 'BodySemibold'
  const navigateAppend = C.Router2.navigateAppend
  const onClick = () => {
    navigateAppend({name: 'team', params: {teamID}})
  }
  const maxWidthStyle = useMaxWidthStyle(conversationIDKey)

  return (
    <Kb.Box2 direction="vertical" style={maxWidthStyle}>
      <Kb.Box2 direction="horizontal" alignItems="center" alignSelf="center" style={styles.channelHeaderContainer}>
        <Kb.Avatar
          teamname={teamname || undefined}
          size={16}
        />
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
        {smallTeam && <ShhIcon conversationIDKey={conversationIDKey} />}
      </Kb.Box2>
      {!smallTeam && (
        <Kb.Box2 direction="horizontal" alignItems="center" alignSelf="center" style={styles.channelHeaderContainer}>
          <Kb.Text type="BodyBig" style={styles.channelName} lineClamp={1} ellipsizeMode="tail">
            #{channelname}
          </Kb.Text>
          <ShhIcon conversationIDKey={conversationIDKey} />
        </Kb.Box2>
      )}
    </Kb.Box2>
  )
}

const emptyArray = new Array<string>()
const UsernameHeader = (props: HeaderConversationProps) => {
  const {conversationIDKey} = props
  const you = useCurrentUserState(s => s.username)
  const infoMap = useUsersState(s => s.infoMap)
  const {meta, participants: participantInfo} = useConversationMetadata(conversationIDKey)
  const participants = meta.teamname ? emptyArray : participantInfo.name
  const theirFullname =
    participants.length === 2
      ? participants.filter(username => username !== you).map(username => infoMap.get(username)?.fullname)[0]
      : undefined
  const onShowProfile = (username: string) => {
    navToProfile(username)
  }

  const maxWidthStyle = useMaxWidthStyle(conversationIDKey)

  return (
    <Kb.Box2
      direction="vertical"
      style={Kb.Styles.collapseStyles([styles.usernameHeaderContainer, maxWidthStyle])}
    >
      {!!theirFullname && (
        <Kb.Text lineClamp={1} type="BodyBig">
          {theirFullname}
        </Kb.Text>
      )}
      <Kb.Box2 direction="horizontal" centerChildren={true}>
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
        <ShhIcon conversationIDKey={conversationIDKey} />
      </Kb.Box2>
    </Kb.Box2>
  )
}

const PhoneOrEmailHeader = (props: HeaderConversationProps) => {
  const {conversationIDKey} = props
  const {meta, participants: participantInfo} = useConversationMetadata(conversationIDKey)
  const participants = (meta.teamname ? null : participantInfo.name) || emptyArray
  const phoneOrEmail = participants.find(s => s.endsWith('@phone') || s.endsWith('@email')) || ''
  const formattedPhoneOrEmail = assertionToDisplay(phoneOrEmail)
  const name = participantInfo.contactName.get(phoneOrEmail)
  const maxWidthStyle = useMaxWidthStyle(conversationIDKey)
  return (
    <Kb.Box2
      direction="vertical"
      style={Kb.Styles.collapseStyles([styles.usernameHeaderContainer, maxWidthStyle])}
    >
      <Kb.Box2 direction="horizontal" style={styles.lessMargins}>
        <Kb.Text type="BodyBig" lineClamp={1} ellipsizeMode="middle">
          {formattedPhoneOrEmail}
        </Kb.Text>
        <ShhIcon conversationIDKey={conversationIDKey} />
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
        ...Kb.Styles.paddingH(Kb.Styles.globalMargins.tiny),
      },
      channelName: {color: Kb.Styles.globalColors.black},
      channelNameLight: {color: Kb.Styles.globalColors.black_50},
      headerRight: {
        height: 22,
        width: 56,
      },
      iosBackBadgeButton: {
        marginRight: 0,
        minWidth: 0,
        padding: Kb.Styles.globalMargins.xtiny,
      },
      lessMargins: {marginBottom: -5},
      shhIcon: {marginLeft: Kb.Styles.globalMargins.xtiny},
      usernameHeaderContainer: Kb.Styles.centered(),
    }) as const
)
