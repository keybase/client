import * as React from 'react'
import * as T from './types'
import {metasReceived, participantInfoReceived, useInboxMetadataState} from '@/chat/inbox/metadata-store'
import {clearInputIntent, setInputIntent, type InputIntent} from '@/chat/conversation/input-intent-store'
import {refreshInboxLayout} from '@/chat/inbox/inbox-refresh'
import {useCurrentUserState} from '@/stores/current-user'
import * as Tabs from './tabs'
import {
  StackActions,
  TabActions,
  CommonActions,
  type NavigationContainerRef,
  NavigationContext,
  createNavigationContainerRef,
  type NavigationState,
} from '@react-navigation/core'
import type {StaticScreenProps} from '@react-navigation/core'
import type {NavigateAppendType, RouteKeys, RootParamList as KBRootParamList} from '@/router-v2/route-params'
import type {GetOptionsRet, RouteDef} from './types/router'
import {isSplit, threadRouteName} from './chat/layout'
import {ignorePromise, shallowEqual} from './utils'
import {registerDebugClear} from '@/util/debug-registry'
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

export const navigationRef = createNavigationContainerRef()

registerDebugClear(() => {
  navigationRef.current = null
})

export type Route = NavigationState<KBRootParamList>['routes'][0]
// still a little paranoid about some things being missing in this type
export type NavState = Partial<Route['state']>
export type Navigator = NavigationContainerRef<KBRootParamList>

const DEBUG_NAV = __DEV__ && (false as boolean)
// Modal route names, registered at startup from the router config (the single source
// of truth — see modalRoutes in router-v2/routes). A serialized NavigationState route
// does not carry its `presentation`, so we cannot detect modals structurally: a route
// living in the root stack (alongside the tab navigator) is a modal iff its name is in
// this set. Everything else there (e.g. chatConversation, and any other non-modal screen
// pushed above the tab bar on phones) is a genuinely-visible screen.
let modalRouteNames: ReadonlySet<string> | undefined
export const setModalRouteNames = (names: Iterable<string>) => {
  modalRouteNames = new Set<string>(names)
}
const isRootModalRoute = (name: string) => {
  if (!modalRouteNames) {
    throw new Error('modalRouteNames not registered; call setModalRouteNames at startup')
  }
  return modalRouteNames.has(name)
}

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

export const getRootState = (): NavState | undefined => {
  if (!navigationRef.isReady()) return
  return navigationRef.getRootState()
}

export const getTab = (navState?: T.Immutable<NavState>): undefined | Tabs.Tab => {
  const s = navState || getRootState()
  const loggedInRoute = s?.routes?.[0]
  if (loggedInRoute?.name === 'loggedIn') {
    // eslint-disable-next-line
    return loggedInRoute.state?.routes?.[loggedInRoute.state.index ?? 0]?.name as Tabs.Tab
  }
  return undefined
}

const _isLoggedIn = (s: T.Immutable<NavState>) => {
  if (!s) {
    return false
  }
  return s.routes?.[0]?.name === 'loggedIn'
}

export const _getNavigator = () => {
  return navigationRef.isReady() ? navigationRef : undefined
}

const getActiveStackState = (navState?: T.Immutable<NavState>): T.Immutable<NavState> | undefined => {
  const rs = navState || getRootState()
  const findActiveStackState = (
    state: T.Immutable<NavState> | undefined,
    depth: number
  ): T.Immutable<NavState> | undefined => {
    if (!state?.routes || state.index === undefined) {
      return undefined
    }
    if (depth === 0) {
      const topModal = (state.routes.slice(1) as Array<Route>)
        .filter(route => isRootModalRoute(route.name))
        .at(-1)
      if (topModal) {
        return findActiveStackState(topModal.state, depth + 1) ?? state
      }
      const loggedInRoute = state.routes[0] as Route | undefined
      return findActiveStackState(loggedInRoute?.state, depth + 1) ?? (state.type === 'stack' ? state : undefined)
    }
    const childRoute = state.routes[state.index] as Route | undefined
    return findActiveStackState(childRoute?.state, depth + 1) ?? (state.type === 'stack' ? state : undefined)
  }
  return findActiveStackState(rs, 0)
}

// Public API
// gives you loggedin/tab/stackitems + modals
export const getVisiblePath = (navState?: T.Immutable<NavState>, _inludeModals?: boolean) => {
  const rs = navState || getRootState()
  const inludeModals = _inludeModals ?? true

  const findVisibleRoute = (
    arr: T.Immutable<Array<Route>>,
    s: T.Immutable<NavState>,
    depth: number
  ): T.Immutable<Array<Route>> => {
    if (!s?.routes || s.index === undefined) {
      return arr
    }
    let childRoute = s.routes[s.index] as Route | undefined
    if (!childRoute) {
      return arr
    }

    let toAdd: Array<Route>
    let toAddModals: Array<Route> = []
    // special handling of modals, we keep them to the side to add them later, then go down the visible tab
    if (depth === 0) {
      childRoute = s.routes[0] as Route
      toAdd = [childRoute]
      // routes[1+] holds both real modals and root non-modal screens (e.g.
      // chatConversation on phones, stacked above the tab bar). The latter are
      // genuinely visible, so always include them; only gate real modals on includeModals.
      const rest = s.routes.slice(1) as Array<Route>
      toAddModals = inludeModals ? rest : rest.filter(r => !isRootModalRoute(r.name))
    } else {
      // include items in the stack
      if (s.type === 'stack') {
        toAdd = s.routes as Array<Route>
      } else {
        toAdd = [childRoute]
      }
    }

    const nextArr = [...arr, ...toAdd]
    const children = findVisibleRoute(nextArr, childRoute.state, depth + 1)
    return [...children, ...toAddModals]
  }

  if (!rs) return []
  const vs = findVisibleRoute([], rs, 0)
  return vs
}

export const getModalStack = (navState?: T.Immutable<NavState>) => {
  const rs = navState || getRootState()
  if (!rs) {
    return []
  }
  if (!_isLoggedIn(rs)) {
    return []
  }
  return (rs.routes?.slice(1) ?? []).filter(r => isRootModalRoute(r.name))
}

export const getVisibleScreen = (navState?: T.Immutable<NavState>, _inludeModals?: boolean) => {
  const visible = getVisiblePath(navState, _inludeModals ?? true)
  return visible.at(-1)
}

export const logState = () => {
  const rs = getRootState()
  const safePaths = (ps: ReadonlyArray<{key?: string; name?: string}>) =>
    ps.map(p => ({key: p.key, name: p.name}))
  const modals = safePaths(getModalStack(rs))
  const visible = safePaths(getVisiblePath(rs))
  return {loggedIn: _isLoggedIn(rs), modals, visible}
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

export const clearModals = () => {
  if (DEBUG_NAV) {
    console.log('[Nav] clearModals')
  }
  const n = _getNavigator()
  if (!n) return
  const ns = getRootState()
  if (!_isLoggedIn(ns)) {
    return
  }
  const rootRoutes = ns?.routes ?? []
  const keepRoutes = rootRoutes.filter(
    (route, index) => index === 0 || !isRootModalRoute(route.name)
  )
  if (keepRoutes.length !== rootRoutes.length) {
    n.dispatch({
      ...CommonActions.reset({
        ...ns,
        index: keepRoutes.length - 1,
        routes: keepRoutes,
      } as Parameters<typeof CommonActions.reset>[0]),
      target: ns?.key,
    })
  }
}

export const navigateUp = () => {
  if (DEBUG_NAV) {
    console.log('[Nav] navigateUp')
  }
  const n = _getNavigator()
  return n?.dispatch(CommonActions.goBack())
}

export const popStack = () => {
  if (DEBUG_NAV) {
    console.log('[Nav] popStack')
  }
  const n = _getNavigator()
  n?.dispatch(StackActions.popToTop())
}

export function navUpToScreen(name: RouteKeys): void
export function navUpToScreen(path: NavigateAppendType, replaceIfMissing?: boolean): void
export function navUpToScreen(nameOrPath: RouteKeys | NavigateAppendType, replaceIfMissing = false) {
  if (DEBUG_NAV) {
    console.log('[Nav] navUpToScreen', {nameOrPath, replaceIfMissing})
  }
  const n = _getNavigator()
  if (!n) return
  const activeStackState = getActiveStackState()
  const activeStackKey = activeStackState?.key
  if (typeof nameOrPath === 'string') {
    const action = StackActions.popTo(nameOrPath)
    n.dispatch(activeStackKey ? {...action, target: activeStackKey} : action)
    return
  }

  const routeName = nameOrPath.name
  const params = nameOrPath.params as object

  const activeStackRoutes = activeStackState?.routes as Array<Route> | undefined
  let routeIndex = -1
  if (activeStackRoutes) {
    for (let i = activeStackRoutes.length - 1; i >= 0; i--) {
      if (activeStackRoutes[i]?.name === routeName) {
        routeIndex = i
        break
      }
    }
  }
  if (routeIndex >= 0 && activeStackState) {
    const nextRoutes = activeStackRoutes!.slice(0, routeIndex + 1).map((route, index) =>
      index === routeIndex ? {...route, params} : route
    )
    n.dispatch({
      ...CommonActions.reset({
        ...activeStackState,
        index: routeIndex,
        routes: nextRoutes,
      } as Parameters<typeof CommonActions.reset>[0]),
      target: activeStackKey,
    })
    return
  }

  if (replaceIfMissing) {
    const action = StackActions.replace(routeName, params)
    n.dispatch(activeStackKey ? {...action, target: activeStackKey} : action)
    return
  }

  const action = StackActions.popTo(routeName)
  n.dispatch(activeStackKey ? {...action, target: activeStackKey} : action)
}

// A push dispatched this tick isn't in getRootState() until React Navigation commits, so the
// visible-route dupe check below misses repeat taps that land before the commit (e.g. a janky JS
// thread queueing both). Track the in-flight push until the next state event; the time bound is a
// backstop in case the container tears down before the listener fires.
let _pendingAppend: {name: string; params?: object; time: number} | undefined

// Returns whether the target is now the visible route - either because we dispatched, or
// because we were already there. False means nothing happened and nothing will.
export function navigateAppend(path: NavigateAppendType, replace?: boolean): boolean {
  if (DEBUG_NAV) {
    console.log('[Nav] navigateAppend', {path})
  }
  const n = _getNavigator()
  if (!n) {
    return false
  }
  const ns = getRootState()
  if (!ns) {
    return false
  }
  const nextPath = path as {name: string | number | symbol; params: object}
  const routeName = typeof nextPath.name === 'string' ? nextPath.name : String(nextPath.name)
  const params = nextPath.params
  if (!routeName) {
    if (DEBUG_NAV) {
      console.log('[Nav] navigateAppend no routeName bail', routeName)
    }
    return false
  }
  const vp = getVisiblePath(ns)
  const visible = vp.at(-1)
  if (visible) {
    if (routeName === visible.name && shallowEqual(visible.params, params)) {
      console.log('Skipping append dupe')
      // Already the visible route with these params - the caller's goal is met.
      return true
    }
  }

  if (replace) {
    if (visible?.name === routeName) {
      n.dispatch(CommonActions.setParams(params))
      return true
    } else {
      n.dispatch(StackActions.replace(routeName, params))
      return true
    }
  }

  if (
    _pendingAppend?.name === routeName &&
    shallowEqual(_pendingAppend.params, params) &&
    Date.now() - _pendingAppend.time < 1000
  ) {
    console.log('Skipping append dupe (uncommitted)')
    // An identical push is already in flight and uncommitted.
    return true
  }
  _pendingAppend = {name: routeName, params, time: Date.now()}
  const unsub = n.addListener('state', () => {
    _pendingAppend = undefined
    unsub()
  })
  n.dispatch(StackActions.push(routeName, params))
  return true
}

export const switchTab = (name: Tabs.AppTab) => {
  if (DEBUG_NAV) {
    console.log('[Nav] switchTab', {name})
  }
  const n = _getNavigator()
  if (!n) return
  const ns = getRootState()
  const tabNavState = ns?.routes?.[0]?.state
  if (!tabNavState?.key) return
  n.dispatch({
    ...TabActions.jumpTo(name),
    target: tabNavState.key,
  })
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

// Returns whether chatRoot now carries these params - by dispatch, or because it already did.
// False means the nav tree was not in a state where anything could happen.
export const setChatRootParams = (
  params: Partial<NonNullable<KBRootParamList['chatRoot']>>
): boolean => {
  const n = _getNavigator()
  if (!n) return false
  const rs = getRootState()
  const tabNavState = rs?.routes?.[0]?.state
  if (!tabNavState?.key) return false
  const tabRoutes = tabNavState.routes as Array<Route>
  const chatTabIndex = tabRoutes.findIndex(r => r.name === Tabs.chatTab)
  if (chatTabIndex < 0) return false
  const chatTabRoute = tabRoutes[chatTabIndex]
  const chatStackState = chatTabRoute?.state
  const chatStackRoutes = chatStackState?.routes as Array<Route> | undefined
  const chatStackIndex = chatStackState?.index ?? 0
  const currentChatRoute = chatStackRoutes?.[chatStackIndex]
  const currentChatRoot = chatStackRoutes?.[0]
  const updatedRoutes = tabRoutes.map((route, i) => {
    if (i !== chatTabIndex) return route
    const currentParams = currentChatRoot?.name === 'chatRoot' ? currentChatRoot.params : undefined
    return {
      ...route,
      state: {
        ...(route.state ?? {}),
        index: 0,
        routes: [{name: 'chatRoot', params: {...currentParams, ...params}}],
      },
    }
  })
  const nextChatRoot = updatedRoutes[chatTabIndex]?.state?.routes[0]
  if (
    tabNavState.index === chatTabIndex &&
    currentChatRoute?.name === 'chatRoot' &&
    chatStackState?.key &&
    nextChatRoot?.params
  ) {
    // When split chat is already showing chatRoot, update that route in place instead of
    // resetting the whole tab navigator. This avoids an extra same-screen navigation when
    // the tab becomes visible and chat selects a thread immediately afterward.
    if (!shallowEqual(currentChatRoute.params, nextChatRoot.params)) {
      n.dispatch({
        ...CommonActions.navigate('chatRoot', nextChatRoot.params, {merge: true}),
        target: chatStackState.key,
      })
    }
    // Either we just merged the params in, or they were already what we wanted.
    return true
  }
  n.dispatch({
    ...CommonActions.reset({...tabNavState, index: chatTabIndex, routes: updatedRoutes} as Parameters<
      typeof CommonActions.reset
    >[0]),
    target: tabNavState.key,
  })
  return true
}

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
  const n = _getNavigator()
  if (!n) return false
  const rs = getRootState()
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
    const nextState = {
      index: 1,
      routes: [
        {
          name: 'loggedIn',
          state: {
            routes: [{name: Tabs.chatTab, state: {index: 0, routes: [{name: 'chatRoot', params: {}}]}}],
          },
        },
        {name: 'chatConversation', params},
      ],
    }
    n.dispatch({
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
      const n = _getNavigator()
      n?.dispatch({...CommonActions.setParams(params), source: visible?.key})
      navigated = !!n
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
