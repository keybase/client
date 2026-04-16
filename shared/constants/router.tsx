import type * as React from 'react'
import * as T from './types'
import type * as ConvoRegistryType from '@/stores/convo-registry'
import type * as ConvoStateType from '@/stores/convostate'
import * as Tabs from './tabs'
import {
  StackActions,
  TabActions,
  CommonActions,
  type NavigationContainerRef,
  useFocusEffect,
  createNavigationContainerRef,
  type NavigationState,
} from '@react-navigation/core'
import type {StaticScreenProps} from '@react-navigation/core'
import type {NavigateAppendType, RouteKeys, RootParamList as KBRootParamList} from '@/router-v2/route-params'
import type {GetOptionsRet, RouteDef} from './types/router'
import {isSplit} from './chat/layout'
import {isMobile} from './platform'
import {ignorePromise, shallowEqual} from './utils'
import {registerDebugClear} from '@/util/debug'
import {makeUUID} from '@/util/uuid'
import {storeRegistry} from '@/stores/store-registry'
import * as Meta from './chat/meta'
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
      ? undefined
      : keyof P extends never
        ? undefined
        : P
    : undefined

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
const rootNonModalRouteNames = new Set<string>(['chatConversation'])

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
      if (inludeModals) {
        toAddModals = s.routes.slice(1) as Array<Route>
      }
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
  return (rs.routes?.slice(1) ?? []).filter(r => !rootNonModalRouteNames.has(r.name))
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

export const getRouteTab = (route: Array<Route>) => {
  return route[1]?.name
}

export const getRouteLoggedIn = (route: Array<Route>) => {
  return route[0]?.name === 'loggedIn'
}

// if a toast is inside of a portal then its not in nav so we can't use useFocusEffect and
// maybe other places also
export const useSafeFocusEffect = (fn: () => void) => {
  try {
    useFocusEffect(fn)
  } catch {}
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
  DEBUG_NAV && console.log('[Nav] clearModals')
  const n = _getNavigator()
  if (!n) return
  const ns = getRootState()
  if (!_isLoggedIn(ns)) {
    return
  }
  const rootRoutes = ns?.routes ?? []
  const keepRoutes = rootRoutes.filter(
    (route, index) => index === 0 || rootNonModalRouteNames.has(route.name)
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
  DEBUG_NAV && console.log('[Nav] navigateUp')
  const n = _getNavigator()
  return n?.dispatch(CommonActions.goBack())
}

export const popStack = () => {
  DEBUG_NAV && console.log('[Nav] popStack')
  const n = _getNavigator()
  n?.dispatch(StackActions.popToTop())
}

export const navUpToScreen = (name: RouteKeys) => {
  DEBUG_NAV && console.log('[Nav] navUpToScreen', {name})
  const n = _getNavigator()
  if (!n) return
  n.dispatch(StackActions.popTo(typeof name === 'string' ? name : String(name)))
}

export function navigateAppend(path: NavigateAppendType, replace?: boolean) {
  DEBUG_NAV && console.log('[Nav] navigateAppend', {path})
  const n = _getNavigator()
  if (!n) {
    return
  }
  const ns = getRootState()
  if (!ns) {
    return
  }
  let routeName: string | undefined
  let params: object | undefined
  if (typeof path === 'string') {
    routeName = path
  } else {
    const nextPath = path as {name: string | number | symbol; params?: object}
    routeName = typeof nextPath.name === 'string' ? nextPath.name : String(nextPath.name)
    params = nextPath.params
  }
  if (!routeName) {
    DEBUG_NAV && console.log('[Nav] navigateAppend no routeName bail', routeName)
    return
  }
  const vp = getVisiblePath(ns)
  const visible = vp.at(-1)
  if (visible) {
    if (routeName === visible.name && shallowEqual(visible.params, params)) {
      console.log('Skipping append dupe')
      return
    }
  }

  if (replace) {
    if (visible?.name === routeName) {
      params && n.dispatch(CommonActions.setParams(params))
      return
    } else {
      n.dispatch(StackActions.replace(routeName, params))
      return
    }
  }

  n.dispatch(StackActions.push(routeName, params))
}

export const switchTab = (name: Tabs.AppTab) => {
  DEBUG_NAV && console.log('[Nav] switchTab', {name})
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

export const navigateToInbox = (allowSwitchTab = true) => {
  // Components can call this during render sometimes, so always defer.
  setTimeout(() => {
    if (getTab() !== Tabs.chatTab) {
      if (allowSwitchTab) {
        switchTab(Tabs.chatTab)
      }
      return
    }
    navUpToScreen('chatRoot')
  }, 1)
}

export const previewConversation = (p: PreviewConversationParams) => {
  const previewConversationPersonMakesAConversation = () => {
    const {participants, teamname, highlightMessageID} = p
    if (teamname || !participants) return

    const {chatStores} = require('@/stores/convo-registry') as typeof ConvoRegistryType
    const toFind = [...participants].sort().join(',')
    const toFindN = participants.length
    for (const cs of chatStores.values()) {
      const names = cs.getState().participants.name
      if (names.length !== toFindN) continue
      const participantSet = [...names].sort().join(',')
      if (participantSet === toFind) {
        storeRegistry
          .getConvoState(cs.getState().id)
          .dispatch.navigateToThread('justCreated', highlightMessageID)
        return
      }
    }

    storeRegistry
      .getConvoState(T.Chat.pendingWaitingConversationIDKey)
      .dispatch.navigateToThread('justCreated')
    const {createConversation} = require('@/stores/convostate') as typeof ConvoStateType
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

      storeRegistry
        .getConvoState(conversationIDKey)
        .dispatch.navigateToThread('previewResolved', highlightMessageID)
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
        const {metasReceived} = require('@/stores/convostate') as typeof ConvoStateType
        metasReceived([meta])
      }

      storeRegistry
        .getConvoState(first.conversationIDKey)
        .dispatch.navigateToThread('previewResolved', highlightMessageID)
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

export const setChatRootParams = (params: Partial<NonNullable<KBRootParamList['chatRoot']>>) => {
  const n = _getNavigator()
  if (!n || !isSplit) return
  const rs = getRootState()
  const tabNavState = rs?.routes?.[0]?.state
  if (!tabNavState?.key) return
  const tabRoutes = tabNavState.routes as Array<Route>
  const chatTabIndex = tabRoutes.findIndex(r => r.name === Tabs.chatTab)
  if (chatTabIndex < 0) return
  const chatTabRoute = tabRoutes[chatTabIndex]
  const chatStackState = chatTabRoute?.state
  const chatStackRoutes = chatStackState?.routes as Array<Route> | undefined
  const chatStackIndex = chatStackState?.index ?? 0
  const currentChatRoute = chatStackRoutes?.[chatStackIndex]
  const currentChatRoot = chatStackRoutes?.[0]
  const updatedRoutes = tabRoutes.map((route, i) => {
    if (i !== chatTabIndex) return route
    const currentParams =
      currentChatRoot?.name === 'chatRoot' &&
      currentChatRoot.params &&
      typeof currentChatRoot.params === 'object'
        ? currentChatRoot.params
        : undefined
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
        ...CommonActions.navigate({merge: true, name: 'chatRoot', params: nextChatRoot.params}),
        target: chatStackState.key,
      })
    }
    return
  }
  n.dispatch({
    ...CommonActions.reset({...tabNavState, index: chatTabIndex, routes: updatedRoutes} as Parameters<
      typeof CommonActions.reset
    >[0]),
    target: tabNavState.key,
  })
}

type ThreadNavParams = {
  createConversationError?: T.Chat.CreateConversationError
  threadSearch?: {query?: string}
}

export const navToThread = (conversationIDKey: T.Chat.ConversationIDKey, navParams?: ThreadNavParams) => {
  DEBUG_NAV && console.log('[Nav] navToThread', conversationIDKey)
  const n = _getNavigator()
  if (!n) return
  const rs = getRootState()
  if (!rs?.key) return
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
    setChatRootParams(params)
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

// Unless you're within the add members wizard you probably should use `TeamsGen.startAddMembersWizard` instead
export const appendNewTeamBuilder = (teamID: T.Teams.TeamID) => {
  navigateAppend({
    name: 'teamsTeamBuilder',
    params: {
      filterServices: ['keybase', 'twitter', 'facebook', 'github', 'reddit', 'hackernews'],
      goButtonLabel: 'Add',
      namespace: 'teams',
      teamID,
      title: '',
    },
  })
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
