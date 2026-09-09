import * as React from 'react'
import * as T from './types'
import {metasReceived, participantInfoReceived, useInboxMetadataState} from '@/chat/inbox/metadata-store'
import {clearInputIntent, setInputIntent, type InputIntent} from '@/chat/conversation/input-intent-store'
import {refreshInboxLayout} from '@/chat/inbox/inbox-refresh'
import {useCurrentUserState} from '@/stores/current-user'
import * as Tabs from './tabs'
import {CommonActions, type NavigationContainerRef, NavigationContext} from '@react-navigation/core'
import type {StaticScreenProps} from '@react-navigation/core'
import type {NavigateAppendType, RouteKeys, RootParamList as KBRootParamList} from '@/router-v2/route-params'
import * as NavTree from './nav-tree'
import {getNavigator} from './navigator'
import type {GetOptionsRet, RouteDef} from './types/router'
import {isSplit, threadRouteName} from './chat/layout'
import {ignorePromise} from './utils'
import {makeUUID} from '@/util/uuid'
import * as Meta from './chat/meta'
import * as Strings from './strings'
import logger from '@/logger'
import {RPCError} from '@/util/errors'

// Detects the unconstrained Record<string,unknown> index-signature type.
// We can't use bidirectional assignability ([Record] extends [T] && [T] extends [Record])
// because TypeScript allows Record<string,unknown> to be assigned to any all-optional-property
// type, making the check incorrectly return true for {x?: string} etc.
// Instead, check for an index signature: string extends keyof T is true only for
// Record<string,unknown>-like types (index signatures), not for specific property types.
type IsExactlyRecord<T> = string extends keyof T ? true : false

type NavigatorParamsFromProps<P> =
  P extends Record<string, unknown>
    ? IsExactlyRecord<P> extends true
      ? {}
      : keyof P extends never
        ? {}
        : P
    : {}

type LazyInnerComponent<COM extends React.LazyExoticComponent<any>> =
  COM extends React.LazyExoticComponent<infer Inner> ? Inner : never

type ScreenParams<COM extends React.LazyExoticComponent<any>> = NavigatorParamsFromProps<
  React.ComponentProps<LazyInnerComponent<COM>>
>
type ScreenComponent<COM extends React.LazyExoticComponent<any>> = (
  p: StaticScreenProps<ScreenParams<COM>>
) => React.ReactElement

export type {Route, NavState} from './nav-tree'
type NavState = NavTree.NavState
export type NavigationRef = NavigationContainerRef<KBRootParamList>

export {setModalRouteNames} from './nav-tree'
export {navigationRef} from './navigator'

const DEBUG_NAV = __DEV__ && (false as boolean)

const uiParticipantsToParticipantInfo = (
  uiParticipants: ReadonlyArray<T.RPCChat.UIParticipant>
): T.Chat.ParticipantInfo => {
  const participantInfo = {all: new Array<string>(), contactName: new Map(), name: new Array<string>()}
  uiParticipants.forEach(part => {
    const {assertion, contactName, inConvName} = part
    participantInfo.all.push(assertion)
    if (inConvName) {
      participantInfo.name.push(assertion)
    }
    if (contactName) {
      participantInfo.contactName.set(assertion, contactName)
    }
  })
  return participantInfo
}

export const getRootState = (): NavState | undefined => getNavigator().getRootState()

export const getTab = (navState?: T.Immutable<NavState>): undefined | Tabs.Tab =>
  NavTree.currentTab(navState || getRootState())

// Public API
// gives you loggedin/tab/stackitems + modals
export const getVisiblePath = (navState?: T.Immutable<NavState>, includeModals?: boolean) =>
  NavTree.visiblePath(navState || getRootState(), {includeModals})

export const getModalStack = (navState?: T.Immutable<NavState>) =>
  NavTree.modalStack(navState || getRootState())

export const getVisibleScreen = (navState?: T.Immutable<NavState>, includeModals?: boolean) =>
  NavTree.visibleScreen(navState || getRootState(), {includeModals})

export const logState = () => {
  const rs = getRootState()
  const safePaths = (ps: ReadonlyArray<{key?: string; name?: string}>) =>
    ps.map(p => ({key: p.key, name: p.name}))
  const modals = safePaths(getModalStack(rs))
  const visible = safePaths(getVisiblePath(rs))
  return {loggedIn: NavTree.isLoggedIn(rs), modals, visible}
}

// if a toast is inside of a portal then its not in nav so useFocusEffect would throw,
// and maybe other places also. Read the navigation context directly and no-op when absent.
// Like useFocusEffect, a non-memoized fn re-runs the effect every render while focused.
export const useSafeFocusEffect = (fn: React.EffectCallback) => {
  const navigation = React.useContext(NavigationContext)
  React.useEffect(() => {
    if (!navigation) {
      return undefined
    }
    let cleanup: ReturnType<React.EffectCallback>
    const runCleanup = () => {
      if (typeof cleanup === 'function') {
        cleanup()
      }
      cleanup = undefined
    }
    const runEffect = () => {
      runCleanup()
      cleanup = fn()
    }
    if (navigation.isFocused()) {
      runEffect()
    }
    const unsubFocus = navigation.addListener('focus', runEffect)
    const unsubBlur = navigation.addListener('blur', runCleanup)
    return () => {
      runCleanup()
      unsubFocus()
      unsubBlur()
    }
  }, [navigation, fn])
}

// Helper to reduce boilerplate in route definitions
// Works for components with or without route params
export function makeScreen<COM extends React.LazyExoticComponent<any>>(
  Component: COM,
  options?: {
    getOptions?: GetOptionsRet | ((props: StaticScreenProps<ScreenParams<COM>>) => GetOptionsRet)
  }
): RouteDef<ScreenComponent<COM>, ScreenParams<COM>> {
  const getOptionsOption = options?.getOptions
  const getOptions =
    typeof getOptionsOption === 'function'
      ? (p: StaticScreenProps<ScreenParams<COM>>) =>
          getOptionsOption({
            ...p,
            route: {
              ...p.route,
              // eslint-disable-next-line
              params: (p.route.params ?? {}) as ScreenParams<COM>,
            },
          })
      : getOptionsOption
  return {
    ...options,
    getOptions,
    screen: function Screen(p: StaticScreenProps<ScreenParams<COM>>) {
      const Comp = Component as any
      // eslint-disable-next-line
      return <Comp {...(p.route.params ?? {})} />
    },
  }
}

// Free-function facade over the default Navigator. Every call site in the app goes
// through these; the adapter underneath is what tests swap.
export const clearModals = () => {
  getNavigator().clearModals()
}

export const navigateUp = () => {
  getNavigator().navigateUp()
}

export const popStack = () => {
  getNavigator().popStack()
}

export function navUpToScreen(name: RouteKeys): void
export function navUpToScreen(path: NavigateAppendType, replaceIfMissing?: boolean): void
export function navUpToScreen(nameOrPath: RouteKeys | NavigateAppendType, replaceIfMissing = false) {
  getNavigator().navUpToScreen(nameOrPath, replaceIfMissing)
}

export function navigateAppend(path: NavigateAppendType, replace?: boolean): boolean {
  return getNavigator().navigateAppend(path, replace)
}

export const switchTab = (name: Tabs.AppTab) => {
  getNavigator().switchTab(name)
}

export const navToProfile = (username: string) => {
  if (isMobile) {
    clearModals()
  }
  navigateAppend({name: 'profile', params: {username}})
}

// prettier-ignore
export type PreviewReason =
  | 'appLink' | 'channelHeader' | 'convertAdHoc' | 'files' | 'forward' | 'fromAReset'
  | 'journeyCardPopular' | 'manageView' | 'memberView' | 'messageLink' | 'newChannel'
  | 'profile' | 'requestedPayment' | 'resetChatWithoutThem' | 'search' | 'sentPayment'
  | 'teamHeader' | 'teamInvite' | 'teamMember' | 'teamMention' | 'teamRow' | 'tracker' | 'transaction'

export type PreviewConversationParams = {
  participants?: ReadonlyArray<string>
  teamname?: string
  channelname?: string
  conversationIDKey?: T.Chat.ConversationIDKey
  highlightMessageID?: T.Chat.MessageID
  reason: PreviewReason
}

export const navigateToInbox = (
  allowSwitchTab = true,
  refreshReason: T.Chat.RefreshReason = 'navigatedToInbox'
) => {
  // Components can call this during render sometimes, so always defer.
  setTimeout(() => {
    const refreshInbox = {nonce: makeUUID(), reason: refreshReason}
    if (getTab() !== Tabs.chatTab) {
      if (allowSwitchTab) {
        setChatRootParams({refreshInbox})
        switchTab(Tabs.chatTab)
      }
      return
    }
    setChatRootParams({refreshInbox})
    navUpToScreen('chatRoot')
  }, 1)
}

export const leaveConversation = (
  conversationIDKey: T.Chat.ConversationIDKey,
  navToInbox = true
) => {
  ignorePromise(
    (async () => {
      await T.RPCChat.localLeaveConversationLocalRpcPromise(
        {convID: T.Chat.keyToConversationID(conversationIDKey)},
        Strings.waitingKeyChatLeaveConversation
      )
    })()
  )
  clearModals()
  if (!navToInbox) {
    return
  }
  navigateToInbox(true, 'leftAConversation')
}

// previewConversation/createConversation carry an optional highlight all the way down; this keeps
// the `{}`-when-absent spread out of every call site.
const highlightIntent = (messageID?: T.Chat.MessageID) =>
  messageID ? ({intent: {messageID, type: 'highlight'}} as const) : undefined

export const createConversation = (
  participants: ReadonlyArray<string>,
  highlightMessageID?: T.Chat.MessageID
) => {
  // TODO This will break if you try to make 2 new conversations at the same time because there is
  // only one pending conversation state.
  // The fix involves being able to make multiple pending conversations.
  const f = async () => {
    const username = useCurrentUserState.getState().username
    if (!username) {
      logger.error('Making a convo while logged out?')
      return
    }

    try {
      const result = await T.RPCChat.localNewConversationLocalRpcPromise(
        {
          identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
          membersType: T.RPCChat.ConversationMembersType.impteamnative,
          tlfName: [...new Set([username, ...participants])].join(','),
          tlfVisibility: T.RPCGen.TLFVisibility.private,
          topicType: T.RPCChat.TopicType.chat,
        },
        Strings.waitingKeyChatCreating
      )
      const {conv, uiConv} = result
      const conversationIDKey = T.Chat.conversationIDToKey(conv.info.id)
      if (!conversationIDKey) {
        logger.warn("Couldn't make a new conversation?")
        return
      }

      const meta = Meta.inboxUIItemToConversationMeta(uiConv)
      if (meta) {
        metasReceived([meta])
      }

      const participantInfo = uiParticipantsToParticipantInfo(uiConv.participants ?? [])
      if (participantInfo.all.length > 0) {
        participantInfoReceived(conversationIDKey, participantInfo)
      }

      navigateToThread(conversationIDKey, 'justCreated', highlightIntent(highlightMessageID))

      refreshInboxLayout('joinedAConversation')
    } catch (error) {
      if (error instanceof RPCError) {
        const fields = error.fields as Array<{key?: string}> | undefined
        const errUsernames = fields?.filter(elem => elem.key === 'usernames') as
          | undefined
          | Array<{key: string; value: string}>
        let disallowedUsers: Array<string> = []
        if (errUsernames?.length) {
          const {value} = errUsernames[0] ?? {value: ''}
          disallowedUsers = value.split(',')
        }
        const allowedUsers = participants.filter(x => !disallowedUsers.includes(x))
        navigateToThread(T.Chat.pendingErrorConversationIDKey, 'justCreated', {
          createConversationError: {
            allowedUsers,
            code: error.code,
            disallowedUsers,
            message: error.desc,
          },
          ...highlightIntent(highlightMessageID),
        })
      }
    }
  }

  ignorePromise(f())
}

// Park the thread screen on the pending placeholder while localNewConversation runs, seeding it
// with the participants we already know. The seed is what lets the switch to the created
// conversation be a setParams instead of a new screen: iOS measures the header title subview once
// and never re-measures one that started empty, so a title-less pending thread would leave the bar
// blank for the real conv too (measured on device in bc6e852a97). It also just reads better - you
// see who you're talking to while the conversation is being made.
export const navigateToPendingThread = (participants: ReadonlyArray<string>) => {
  const {username} = useCurrentUserState.getState()
  // matches participants.name for a real conv: the tlf name, which includes you
  const name = [...new Set([username, ...participants])]
  participantInfoReceived(T.Chat.pendingWaitingConversationIDKey, {
    all: name,
    contactName: new Map(),
    name,
  })
  navigateToThread(T.Chat.pendingWaitingConversationIDKey, 'justCreated')
}

export const previewConversation = (p: PreviewConversationParams) => {
  const previewConversationPersonMakesAConversation = () => {
    const {participants, teamname, highlightMessageID} = p
    if (teamname || !participants) return

    const toFind = [...participants].sort().join(',')
    const toFindN = participants.length
    for (const [conversationIDKey, participantInfo] of useInboxMetadataState.getState().participants) {
      const names = participantInfo.name
      if (names.length !== toFindN) continue
      const participantSet = [...names].sort().join(',')
      if (participantSet === toFind) {
        navigateToThread(conversationIDKey, 'justCreated', highlightIntent(highlightMessageID))
        return
      }
    }

    navigateToPendingThread(participants)
    createConversation(participants, highlightMessageID)
  }

  const previewConversationTeam = async () => {
    const {conversationIDKey, highlightMessageID, teamname, reason} = p
    if (conversationIDKey) {
      if (
        reason === 'messageLink' ||
        reason === 'teamMention' ||
        reason === 'channelHeader' ||
        reason === 'manageView'
      ) {
        await T.RPCChat.localPreviewConversationByIDLocalRpcPromise({
          convID: T.Chat.keyToConversationID(conversationIDKey),
        })
      }

      navigateToThread(conversationIDKey, 'previewResolved', highlightIntent(highlightMessageID))
      return
    }

    if (!teamname) {
      return
    }

    const channelname = p.channelname || 'general'
    try {
      const results = await T.RPCChat.localFindConversationsLocalRpcPromise({
        identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
        membersType: T.RPCChat.ConversationMembersType.team,
        oneChatPerTLF: true,
        tlfName: teamname,
        topicName: channelname,
        topicType: T.RPCChat.TopicType.chat,
        visibility: T.RPCGen.TLFVisibility.private,
      })
      const resultMetas = (results.uiConversations || [])
        .map(row => Meta.inboxUIItemToConversationMeta(row))
        .filter(Boolean)

      const first = resultMetas[0]
      if (!first) {
        if (reason === 'appLink') {
          navigateAppend({
            name: 'keybaseLinkError',
            params: {
              error:
                "We couldn't find this team chat channel. Please check that you're a member of the team and the channel exists.",
            },
          })
        }
        return
      }

      const results2 = await T.RPCChat.localPreviewConversationByIDLocalRpcPromise({
        convID: T.Chat.keyToConversationID(first.conversationIDKey),
      })
      const meta = Meta.inboxUIItemToConversationMeta(results2.conv)
      if (meta) {
        metasReceived([meta])
      }

      navigateToThread(first.conversationIDKey, 'previewResolved', highlightIntent(highlightMessageID))
    } catch (error) {
      if (
        error instanceof RPCError &&
        error.code === T.RPCGen.StatusCode.scteamnotfound &&
        reason === 'appLink'
      ) {
        navigateAppend({
          name: 'keybaseLinkError',
          params: {
            error:
              "We couldn't find this team. Please check that you're a member of the team and the channel exists.",
          },
        })
        return
      }
      throw error
    }
  }

  previewConversationPersonMakesAConversation()
  ignorePromise(previewConversationTeam())
}

export const setChatRootParams = (params: Partial<NonNullable<KBRootParamList['chatRoot']>>): boolean =>
  getNavigator().setChatRootParams(params)

export const setThreadInputCommandStatus = (
  conversationIDKey: T.Chat.ConversationIDKey,
  info?: T.Chat.CommandStatusInfo
) => {
  setInputIntent(conversationIDKey, {info, type: 'commandStatus'})
}

export const setThreadInputEditing = (
  conversationIDKey: T.Chat.ConversationIDKey,
  ordinal: T.Chat.Ordinal
) => {
  setInputIntent(conversationIDKey, {ordinal, type: 'setEditing'})
}

export const setThreadInputReplyTo = (
  conversationIDKey: T.Chat.ConversationIDKey,
  ordinal: T.Chat.Ordinal
) => {
  setInputIntent(conversationIDKey, {ordinal, type: 'setReplyTo'})
}

type ThreadNavParams = {
  createConversationError?: T.Chat.CreateConversationError
  threadSearch?: {query?: string}
}

export type NavigateToThreadReason =
  | 'focused'
  | 'clearSelected'
  | 'desktopNotification'
  | 'createdMessagePrivately'
  | 'extension'
  | 'files'
  | 'findNewestConversation'
  | 'findNewestConversationFromLayout'
  | 'inboxBig'
  | 'inboxFilterArrow'
  | 'inboxFilterChanged'
  | 'inboxSmall'
  | 'inboxNewConversation'
  | 'inboxSearch'
  | 'jumpFromReset'
  | 'jumpToReset'
  | 'justCreated'
  | 'manageView'
  | 'previewResolved'
  | 'push'
  | 'savedLastState'
  | 'startFoundExisting'
  | 'teamChat'
  | 'addedToChannel'
  | 'navChanged'
  | 'misc'
  | 'teamMention'

const navToThread = (
  conversationIDKey: T.Chat.ConversationIDKey,
  navParams?: ThreadNavParams
): boolean => {
  if (DEBUG_NAV) {
    console.log('[Nav] navToThread', conversationIDKey)
  }
  const nav = getNavigator()
  if (!nav.isReady()) return false
  const rs = nav.getRootState()
  if (!rs?.key) return false
  const params = {
    conversationIDKey,
    createConversationError: navParams?.createConversationError,
    threadSearch: navParams?.threadSearch,
  }

  if (isSplit) {
    // Desktop/tablet: reset the tab navigator state to switch to chatTab with chatRoot params.
    // All tab stacks share the same screen config, so navigate('chatRoot') would target the
    // current tab. Separate switchTab + navigateAppend has a race (stale state between dispatches).
    // A single reset on the tab navigator atomically switches tabs and sets params.
    return setChatRootParams(params)
  } else {
    // Phone: switch to the chat tab, then push the conversation above the tabs.
    const nextState = NavTree.pushedAboveTabs(Tabs.chatTab, {name: 'chatConversation', params})
    nav.dispatch({
      ...CommonActions.reset(nextState as Parameters<typeof CommonActions.reset>[0]),
      target: rs.key,
    })
    return true
  }
}

export const navigateToThread = (
  conversationIDKey: T.Chat.ConversationIDKey,
  reason: NavigateToThreadReason,
  opts?: {
    // One slot: an intent is either a highlight or a composer instruction, never both, so
    // "highlight and prefill at once" is unrepresentable instead of a runtime coin-flip.
    intent?: InputIntent
    threadSearchQuery?: string
    createConversationError?: T.Chat.CreateConversationError
  }
) => {
  if (reason === 'navChanged') {
    return
  }

  const {createConversationError, intent, threadSearchQuery} = opts ?? {}

  const visible = getVisibleScreen()
  const params = visible?.params as {conversationIDKey?: T.Chat.ConversationIDKey} | undefined
  const visibleConvo = params?.conversationIDKey
  const visibleRouteName = visible?.name

  if (visibleRouteName !== threadRouteName && reason === 'findNewestConversation') {
    return
  }

  // Written here, above every dispatch: the thread mounts during those dispatches and consumes on
  // mount, so an intent written afterwards would miss it. But a dispatch can still turn out not to
  // happen - navToThread, setChatRootParams and navigateAppend each bail when the navigator, root
  // state or tab tree is unavailable - and a durable intent left behind by a navigation that never
  // occurred would fire on some later, unrelated mount of this conversation. So the write is rolled
  // back below unless the path we took reports that it landed.
  if (intent) {
    setInputIntent(conversationIDKey, intent)
  }

  const threadSearch = threadSearchQuery ? {query: threadSearchQuery} : undefined
  const navParams = {
    createConversationError,
    threadSearch,
  }
  let navigated: boolean
  if (isSplit) {
    navigated = navToThread(conversationIDKey, navParams)
  } else if (reason === 'push' || reason === 'savedLastState') {
    navigated = navToThread(conversationIDKey, navParams)
  } else {
    // Either half being true means "retarget the screen we're already on" instead of pushing a
    // new one. The second half must not rely on the two params objects happening to have the
    // same keys (navigateAppend's dupe guard does a shallow-equal that bails on key-count
    // mismatch alone) - a route built outside this file, e.g. a deep link's single-key
    // {conversationIDKey} from router-v2/linking.tsx's makeChatConversationState, would defeat
    // that check and let a same-conversation call push a second thread screen.
    const replace =
      visibleRouteName === threadRouteName &&
      (!T.Chat.isValidConversationIDKey(visibleConvo ?? '') || visibleConvo === conversationIDKey)
    const modalPath = getModalStack()
    if (modalPath.length > 0) {
      clearModals()
    }

    const params = {
      conversationIDKey,
      createConversationError,
      threadSearch,
    }
    if (replace) {
      // pendingWaiting -> real conversation: the same chat arriving, so retarget the live screen.
      // It cannot be a StackActions.replace: react-native-screens always animates a replace on
      // iOS (RNSScreenStack.mm passes `animated:previousTop.view.window != nil`, ignoring
      // stackAnimation, and the animationTypeForReplace:'pop' branch is an animated pop), so the
      // blank pending thread slides in and the real one slides in over it - one new chat reading
      // as two pushes. setParams has no transition at all. It relies on the pending thread's
      // header title already having content (seeded by navigateToPendingThread): iOS never
      // re-measures a title subview it first measured empty, so a blank pending title would
      // leave the bar blank for the real conv too. Same-conversation retargets ride this path
      // too: the screen is already showing real content, so setParams is a plain in-place merge.
      const nav = getNavigator()
      nav.dispatch({...CommonActions.setParams(params), source: visible?.key})
      navigated = nav.isReady()
    } else {
      navigated = navigateAppend({name: threadRouteName, params})
    }
  }

  if (intent && !navigated) {
    clearInputIntent(conversationIDKey, intent)
  }
}

export const appendPeopleBuilder = () => {
  navigateAppend({
    name: 'peopleTeamBuilder',
    params: {
      filterServices: ['facebook', 'github', 'hackernews', 'keybase', 'reddit', 'twitter'],
      namespace: 'people',
      title: '',
    },
  })
}

export const appendNewChatBuilder = () => {
  navigateAppend({name: 'chatNewChat', params: {namespace: 'chat', title: 'New chat'}})
}

export const appendEncryptRecipientsBuilder = () => {
  navigateAppend({
    name: 'cryptoTeamBuilder',
    params: {
      filterServices: ['facebook', 'github', 'hackernews', 'keybase', 'reddit', 'twitter'],
      goButtonLabel: 'Add',
      namespace: 'crypto',
      recommendedHideYourself: true,
      teamBuilderNonce: makeUUID(),
      title: 'Recipients',
    },
  })
}
