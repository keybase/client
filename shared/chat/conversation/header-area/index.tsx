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
import {useInboxMetadataState} from '@/chat/inbox/metadata'
import {muteConversation} from '../status-actions'
import {getBigLayoutChannelRow, getSmallLayoutRow, useInboxLayoutState} from '@/chat/inbox/layout-state'

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
// The title renders from the metas/participants maps, which fill via the unbox flow and can
// lag (or entirely miss) a conv the inbox layout already knows about. The layout row is what
// the inbox list renders from and effectively always has display names, so fall back to it:
// the header paints immediately and upgrades when ensureConversationMetaLoaded lands.
const useLayoutFallbackNames = (conversationIDKey: T.Chat.ConversationIDKey) =>
  useInboxLayoutState(
    C.useShallow(s => {
      const small = getSmallLayoutRow(s, conversationIDKey)
      const big = getBigLayoutChannelRow(s, conversationIDKey)
      return {
        bigChannelname: big?.channelname ?? '',
        bigTeamname: big?.teamname ?? '',
        smallIsTeam: small?.isTeam ?? false,
        smallName: small?.name ?? '',
      }
    })
  )

const HeaderBranchContainerInner = function HeaderBranchContainerInner(props: HeaderConversationProps) {
  const {conversationIDKey} = props
  const {meta, participants: participantInfo} = useConversationMetadata(conversationIDKey)
  const fallback = useLayoutFallbackNames(conversationIDKey)
  const teamname = meta.teamname || fallback.bigTeamname || (fallback.smallIsTeam ? fallback.smallName : '')
  if (teamname) {
    return (
      <ChannelHeader
        conversationIDKey={conversationIDKey}
        teamname={teamname}
        channelname={meta.channelname || fallback.bigChannelname}
      />
    )
  }
  // the small-row name is the tlf name (comma-joined usernames, includes you), matching
  // participants.name semantics
  const participants = participantInfo.name.length
    ? participantInfo.name
    : fallback.smallName
      ? fallback.smallName
          .split(',')
          .map(username => username.trim())
          .filter(Boolean)
      : emptyArray
  const isPhoneOrEmail = participants.some(
    participant => participant.endsWith('@phone') || participant.endsWith('@email')
  )
  return isPhoneOrEmail ? (
    <PhoneOrEmailHeader conversationIDKey={conversationIDKey} participants={participants} />
  ) : (
    <UsernameHeader conversationIDKey={conversationIDKey} participants={participants} />
  )
}

const BadgeHeaderLeftArray = (p: HeaderBackButtonProps & HeaderConversationProps) => {
  const {conversationIDKey, ...rest} = p
  const badgeNumber = useBackBadge(conversationIDKey)
  return <HeaderLeftButton badgeNumber={badgeNumber} {...rest} />
}

const sfIcon = (name: SFSymbol) => ({name, type: 'sfSymbol' as const})

// iOS: back-button options for a given badge count. Badged = custom bar item carrying a native
// UIBarButtonItem badge (iOS 26+) or our own back button (pre-26); unbadged = native back button.
const iosBackOptions = (badgeNumber: number) =>
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
                // void wrapper: navigateUp's inferred return type references the nav state
                // (RootParamList), which circularly depends on this options function's type
                onPress: () => {
                  C.Router2.navigateUp()
                },
                type: 'button' as const,
              }
            : {
                element: <Kb.BackButton badgeNumber={badgeNumber} style={styles.iosBackBadgeButton} />,
                type: 'custom' as const,
              },
        ],
      }
    : {headerBackVisible: true, unstable_headerLeftItems: undefined}

export const headerNavigationOptions = (route: {params?: {conversationIDKey?: T.Chat.ConversationIDKey}}) => {
  if (!isMobile) return {}
  const conversationIDKey = route.params?.conversationIDKey ?? Chat.noConversationIDKey
  return {
    // iOS 26: the back button (badged or not) is decided synchronously here so the header is
    // complete in the screen's initial options — swapping bar items via setOptions while the
    // push animation runs restarts the UINavigationBar item transition (header freezes, then
    // jumps to catch up with the screen slide). BadgeHeaderUpdater only applies later badge
    // changes, after the transition ends.
    ...(!isIOS
      ? {
          headerBackVisible: false,
          headerLeft: (props: HeaderBackButtonProps) => {
            const {labelStyle, ...rest} = props
            return <BadgeHeaderLeftArray {...rest} conversationIDKey={conversationIDKey} />
          },
        }
      : iosBackOptions(getBackBadge(conversationIDKey))),
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

const badgeCountExcluding = (
  badgeState: ReturnType<typeof useConfigState.getState>['badgeState'],
  conversationIDKey: T.Chat.ConversationIDKey
) =>
  badgeState?.conversations?.reduce((count, conversation) => {
    const id = T.Chat.conversationIDToKey(conversation.convID)
    return id === conversationIDKey ? count : count + conversation.badgeCount
  }, 0) ?? 0

// explicit return types: getVisiblePath's type references the nav state (RootParamList), which
// circularly depends on this options function's type if left to inference
const onTopOfInbox = (): boolean => {
  const visiblePath = C.Router2.getVisiblePath()
  return visiblePath[visiblePath.length - 2]?.name === 'chatRoot'
}

// non-reactive read for options-evaluation time
const getBackBadge = (conversationIDKey: T.Chat.ConversationIDKey): number =>
  onTopOfInbox() ? badgeCountExcluding(useConfigState.getState().badgeState, conversationIDKey) : 0

const useBackBadge = (conversationIDKey: T.Chat.ConversationIDKey) => {
  const badgeState = useConfigState(s => s.badgeState)
  const badgeNumber = badgeCountExcluding(badgeState, conversationIDKey)
  if (!onTopOfInbox()) return 0
  return badgeNumber
}

// UIBarButtonItem.badge (and the glass pill bar items) need iOS 26.
const isIOS26Plus = isIOS && parseInt(Platform.Version as string, 10) >= 26

// Whether the title component has any text to render right now — mirrors
// HeaderBranchContainerInner's data sources (meta, participants, inbox-layout fallback).
const hasTitleFromMetadataSelector =
  (conversationIDKey: T.Chat.ConversationIDKey) =>
  (s: ReturnType<typeof useInboxMetadataState.getState>) =>
    !!(s.metas.get(conversationIDKey)?.teamname || s.participants.get(conversationIDKey)?.name.length)
const hasTitleFromLayoutSelector =
  (conversationIDKey: T.Chat.ConversationIDKey) =>
  (s: ReturnType<typeof useInboxLayoutState.getState>) =>
    !!(
      getSmallLayoutRow(s, conversationIDKey)?.name ||
      getBigLayoutChannelRow(s, conversationIDKey)?.teamname
    )

// iOS only: screen options functions aren't reactive to store state, so a mounted null
// component pushes badge-count changes into the header via setOptions. The initial value is
// already in the screen options (headerNavigationOptions), and any setOptions while the push
// animation runs restarts the bar item transition (header desyncs from the screen slide), so
// updates are held until transitionEnd and skipped when the count hasn't changed.
// Android renders the badge through headerLeft (BadgeHeaderLeftArray) instead.
export const BadgeHeaderUpdater = isIOS
  ? function BadgeHeaderUpdater(props: HeaderConversationProps) {
      const {conversationIDKey} = props
      const badgeNumber = useBackBadge(conversationIDKey)
      const navigation = useNavigation()
      const [transitionDone, setTransitionDone] = React.useState(false)
      // headerNavigationOptions computed this synchronously when the screen was configured
      const lastAppliedRef = React.useRef(getBackBadge(conversationIDKey))
      React.useEffect(() => {
        const addListener = navigation.addListener as (event: string, cb: () => void) => () => void
        let transitionStarted = false
        const unsubscribeStart = addListener('transitionStart', () => {
          transitionStarted = true
        })
        const unsubscribeEnd = addListener('transitionEnd', () => setTransitionDone(true))
        // no transitionStart shortly after mount = no animation to protect (cold start directly
        // into a thread mounts via initial nav state and never gets transition events)
        const noTransitionTimeout = setTimeout(() => {
          if (!transitionStarted) setTransitionDone(true)
        }, 100)
        // safety net in case a started transition never reports its end
        const fallbackTimeout = setTimeout(() => setTransitionDone(true), 1000)
        return () => {
          clearTimeout(noTransitionTimeout)
          clearTimeout(fallbackTimeout)
          unsubscribeStart()
          unsubscribeEnd()
        }
      }, [navigation])
      React.useEffect(() => {
        if (!transitionDone || lastAppliedRef.current === badgeNumber) return
        lastAppliedRef.current = badgeNumber
        navigation.setOptions(iosBackOptions(badgeNumber))
      }, [navigation, badgeNumber, transitionDone])
      // If the title component had no text when the screen was first configured (cold start
      // directly into a thread: the store fills after the header's initial native layout),
      // UINavigationBar never re-measures the title subview when its content later grows — it
      // stays blank until something reconfigures the bar (e.g. a pop transition). Once the
      // data lands, swap in a fresh headerTitle via setOptions to force that reconfigure.
      const hasTitleFromMetadata = useInboxMetadataState(hasTitleFromMetadataSelector(conversationIDKey))
      const hasTitleFromLayout = useInboxLayoutState(hasTitleFromLayoutSelector(conversationIDKey))
      const hasTitleContent = hasTitleFromMetadata || hasTitleFromLayout
      const titleWasEmptyRef = React.useRef(!hasTitleContent)
      React.useEffect(() => {
        if (!transitionDone || !titleWasEmptyRef.current || !hasTitleContent) return
        titleWasEmptyRef.current = false
        navigation.setOptions({
          headerTitle: () => <HeaderBranchContainerInner conversationIDKey={conversationIDKey} />,
        })
      }, [navigation, conversationIDKey, hasTitleContent, transitionDone])
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

const ChannelHeader = (props: HeaderConversationProps & {teamname: string; channelname: string}) => {
  const {conversationIDKey, teamname, channelname} = props
  const {teamType, teamID} = useConversationMetadata(conversationIDKey).meta
  // teamType is 'adhoc' when the meta hasn't loaded yet (we only render on layout-fallback
  // names then); a big-team layout row is the only fallback that carries a channelname
  const smallTeam = teamType !== 'adhoc' ? teamType !== 'big' : !channelname
  const textType = smallTeam ? 'BodyBig' : isMobile ? 'BodyTinySemibold' : 'BodySemibold'
  const navigateAppend = C.Router2.navigateAppend
  const onClick = teamID
    ? () => {
        navigateAppend({name: 'team', params: {teamID}})
      }
    : undefined
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
type HeaderParticipantsProps = HeaderConversationProps & {participants: ReadonlyArray<string>}
const UsernameHeader = (props: HeaderParticipantsProps) => {
  const {conversationIDKey, participants} = props
  const you = useCurrentUserState(s => s.username)
  const infoMap = useUsersState(s => s.infoMap)
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

const PhoneOrEmailHeader = (props: HeaderParticipantsProps) => {
  const {conversationIDKey, participants} = props
  const {participants: participantInfo} = useConversationMetadata(conversationIDKey)
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
