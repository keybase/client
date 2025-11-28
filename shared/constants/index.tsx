// Type-only exports (no runtime cost)
export * from './platform'
export {wrapErrors} from '@/util/debug'
export type {useState_ as useDarkModeState} from './darkmode'
export type {useState_ as useRouterState, makeScreen} from './router2'
export type * as Router2 from './router2'
export type {useState_ as useDeepLinksState} from './deeplinks'
export type {useState_ as useDaemonState, maxHandshakeTries} from './daemon'
export type {useState_ as useEngineState} from './engine'
export type {useState_ as useWaitingState} from './waiting'
export type {useConfigState_ as useConfigState, type Store as ConfigStore} from './config'
export type * as DeepLinks from './deeplinks'
export type {TBProvider_ as TBProvider, stores_ as TBstores, useContext_ as useTBContext} from './team-building'
export type * as TeamBuilding from './team-building'
export type {useState_ as useGitState} from './git'
export type * as Git from './git'
export type {useState_ as useProvisionState} from './provision'
export type * as Provision from './provision'
export type {useState_ as useActiveState} from './active'
export type {useState_ as useAutoResetState} from './autoreset'
export type * as AutoReset from './autoreset'
export type {useState_ as useBotsState} from './bots'
export type * as Bots from './bots'
export type {useState_ as useCryptoState} from './crypto'
export type * as Crypto from './crypto'
export type {useState_ as useCurrentUserState} from './current-user'
export type {useState_ as useDevicesState} from './devices'
export type * as Devices from './devices'
export type {useState_ as useFollowerState} from './followers'
export type * as Gregor from './gregor'
export type {useState_ as useLogoutState} from './logout'
export type {useState_ as useNotifState} from './notifications'
export type {useState_ as usePeopleState} from './people'
export type * as People from './people'
export type {useState_ as usePinentryState} from './pinentry'
export type {useState_ as useProfileState} from './profile'
export type * as Profile from './profile'
export type {useState_ as usePushState} from './push'
export type * as Push from './push'
export type {useState_ as useRecoverState} from './recover-password'
export type * as RecoverPwd from './recover-password'
export type * as Settings from './settings'
export type {useState_ as useSettingsState} from './settings'
export type {useState_ as useFSState} from './fs'
export type * as FS from './fs'
export type * as Tabs from './tabs'
export type {useState_ as useSettingsChatState} from './settings-chat'
export type * as SettingsChat from './settings-chat'
export type * as SettingsPhone from './settings-phone'
export type {useState_ as useSettingsPhoneState} from './settings-phone'
export type {useState_ as useSettingsEmailState, addEmailWaitingKey} from './settings-email'
export type {useState_ as useSettingsPasswordState} from './settings-password'
export type {useState_ as useSettingsInvitesState} from './settings-invites'
export type {useState_ as useSettingsNotifState, refreshNotificationsWaitingKey} from './settings-notifications'
export type {useState_ as useSettingsContactsState, importContactsWaitingKey} from './settings-contacts'
export type {useState_ as useSignupState} from './signup'
export type * as Signup from './signup'
export type {useState_ as useTeamsState} from './teams'
export type * as Teams from './teams'
export type {useState_ as useTrackerState} from './tracker2'
export type * as Tracker from './tracker2'
export type {useState_ as useUFState} from './unlock-folders'
export type {useState_ as useUsersState} from './users'
export type * as Users from './users'
export type * as Wallets from './wallets'
export type {useState_ as useWalletsState} from './wallets'
export type {useState_ as useWNState} from './whats-new'
export type {useState_ as useChatState} from './chat2'
export type * as Chat from './chat2'
export type {useConvoState_ as useConvoState, stores_ as chatStores, ChatProvider_ as ChatProvider} from './chat2'
export type {getConvoState_ as getConvoState, useContext_ as useChatContext} from './chat2'
export type * as Config from './config'
export type {useState_ as useArchiveState} from './archive'

// Lazy runtime exports (defer require until accessed)
Object.defineProperty(exports, 'useDarkModeState', {get: () => require('./darkmode').useState_})
Object.defineProperty(exports, 'useRouterState', {get: () => require('./router2').useState_})
Object.defineProperty(exports, 'makeScreen', {get: () => require('./router2').makeScreen})
Object.defineProperty(exports, 'Router2', {get: () => require('./router2')})
Object.defineProperty(exports, 'useDeepLinksState', {get: () => require('./deeplinks').useState_})
Object.defineProperty(exports, 'DeepLinks', {get: () => require('./deeplinks')})
Object.defineProperty(exports, 'TBProvider', {get: () => require('./team-building').TBProvider_})
Object.defineProperty(exports, 'TBstores', {get: () => require('./team-building').stores_})
Object.defineProperty(exports, 'useTBContext', {get: () => require('./team-building').useContext_})
Object.defineProperty(exports, 'TeamBuilding', {get: () => require('./team-building')})
Object.defineProperty(exports, 'useGitState', {get: () => require('./git').useState_})
Object.defineProperty(exports, 'Git', {get: () => require('./git')})
Object.defineProperty(exports, 'useProvisionState', {get: () => require('./provision').useState_})
Object.defineProperty(exports, 'Provision', {get: () => require('./provision')})
Object.defineProperty(exports, 'useActiveState', {get: () => require('./active').useState_})
Object.defineProperty(exports, 'useAutoResetState', {get: () => require('./autoreset').useState_})
Object.defineProperty(exports, 'AutoReset', {get: () => require('./autoreset')})
Object.defineProperty(exports, 'useBotsState', {get: () => require('./bots').useState_})
Object.defineProperty(exports, 'Bots', {get: () => require('./bots')})
Object.defineProperty(exports, 'useCryptoState', {get: () => require('./crypto').useState_})
Object.defineProperty(exports, 'Crypto', {get: () => require('./crypto')})
Object.defineProperty(exports, 'useCurrentUserState', {get: () => require('./current-user').useState_})
Object.defineProperty(exports, 'useDaemonState', {get: () => require('./daemon').useState_})
Object.defineProperty(exports, 'maxHandshakeTries', {get: () => require('./daemon').maxHandshakeTries})
Object.defineProperty(exports, 'useDevicesState', {get: () => require('./devices').useState_})
Object.defineProperty(exports, 'Devices', {get: () => require('./devices')})
Object.defineProperty(exports, 'useEngineState', {get: () => require('./engine').useState_})
Object.defineProperty(exports, 'useFollowerState', {get: () => require('./followers').useState_})
Object.defineProperty(exports, 'Gregor', {get: () => require('./gregor')})
Object.defineProperty(exports, 'useLogoutState', {get: () => require('./logout').useState_})
Object.defineProperty(exports, 'useNotifState', {get: () => require('./notifications').useState_})
Object.defineProperty(exports, 'usePeopleState', {get: () => require('./people').useState_})
Object.defineProperty(exports, 'People', {get: () => require('./people')})
Object.defineProperty(exports, 'usePinentryState', {get: () => require('./pinentry').useState_})
Object.defineProperty(exports, 'useProfileState', {get: () => require('./profile').useState_})
Object.defineProperty(exports, 'Profile', {get: () => require('./profile')})
Object.defineProperty(exports, 'usePushState', {get: () => require('./push').useState_})
Object.defineProperty(exports, 'Push', {get: () => require('./push')})
Object.defineProperty(exports, 'useRecoverState', {get: () => require('./recover-password').useState_})
Object.defineProperty(exports, 'RecoverPwd', {get: () => require('./recover-password')})
Object.defineProperty(exports, 'Settings', {get: () => require('./settings')})
Object.defineProperty(exports, 'useSettingsState', {get: () => require('./settings').useState_})
Object.defineProperty(exports, 'useFSState', {get: () => require('./fs').useState_})
Object.defineProperty(exports, 'FS', {get: () => require('./fs')})
Object.defineProperty(exports, 'Tabs', {get: () => require('./tabs')})
Object.defineProperty(exports, 'useSettingsChatState', {get: () => require('./settings-chat').useState_})
Object.defineProperty(exports, 'SettingsChat', {get: () => require('./settings-chat')})
Object.defineProperty(exports, 'SettingsPhone', {get: () => require('./settings-phone')})
Object.defineProperty(exports, 'useSettingsPhoneState', {get: () => require('./settings-phone').useState_})
Object.defineProperty(exports, 'useSettingsEmailState', {get: () => require('./settings-email').useState_})
Object.defineProperty(exports, 'addEmailWaitingKey', {get: () => require('./settings-email').addEmailWaitingKey})
Object.defineProperty(exports, 'useSettingsPasswordState', {get: () => require('./settings-password').useState_})
Object.defineProperty(exports, 'useSettingsInvitesState', {get: () => require('./settings-invites').useState_})
Object.defineProperty(exports, 'useSettingsNotifState', {get: () => require('./settings-notifications').useState_})
Object.defineProperty(exports, 'refreshNotificationsWaitingKey', {get: () => require('./settings-notifications').refreshNotificationsWaitingKey})
Object.defineProperty(exports, 'useSettingsContactsState', {get: () => require('./settings-contacts').useState_})
Object.defineProperty(exports, 'importContactsWaitingKey', {get: () => require('./settings-contacts').importContactsWaitingKey})
Object.defineProperty(exports, 'useSignupState', {get: () => require('./signup').useState_})
Object.defineProperty(exports, 'Signup', {get: () => require('./signup')})
Object.defineProperty(exports, 'useTeamsState', {get: () => require('./teams').useState_})
Object.defineProperty(exports, 'Teams', {get: () => require('./teams')})
Object.defineProperty(exports, 'useTrackerState', {get: () => require('./tracker2').useState_})
Object.defineProperty(exports, 'Tracker', {get: () => require('./tracker2')})
Object.defineProperty(exports, 'useUFState', {get: () => require('./unlock-folders').useState_})
Object.defineProperty(exports, 'useUsersState', {get: () => require('./users').useState_})
Object.defineProperty(exports, 'Users', {get: () => require('./users')})
Object.defineProperty(exports, 'useWaitingState', {get: () => require('./waiting').useState_})
Object.defineProperty(exports, 'Waiting', {get: () => require('./waiting')})
Object.defineProperty(exports, 'Wallets', {get: () => require('./wallets')})
Object.defineProperty(exports, 'useWalletsState', {get: () => require('./wallets').useState_})
Object.defineProperty(exports, 'useWNState', {get: () => require('./whats-new').useState_})
Object.defineProperty(exports, 'useChatState', {get: () => require('./chat2').useState_})
Object.defineProperty(exports, 'Chat', {get: () => require('./chat2')})
Object.defineProperty(exports, 'useConvoState', {get: () => require('./chat2').useConvoState_})
Object.defineProperty(exports, 'chatStores', {get: () => require('./chat2').stores_})
Object.defineProperty(exports, 'ChatProvider', {get: () => require('./chat2').ChatProvider_})
Object.defineProperty(exports, 'getConvoState', {get: () => require('./chat2').getConvoState_})
Object.defineProperty(exports, 'useChatContext', {get: () => require('./chat2').useContext_})
Object.defineProperty(exports, 'useConfigState', {get: () => require('./config').useConfigState_})
Object.defineProperty(exports, 'Config', {get: () => require('./config')})
Object.defineProperty(exports, 'useArchiveState', {get: () => require('./archive').useState_})

export {default as shallowEqual} from 'shallowequal'
export * as PlatformSpecific from './platform-specific'

export const initListeners = () => {
  const f = async () => {
    await require('./fs').useState_.getState().dispatch.setupSubscriptions()
    require('./config').useConfigState_.getState().dispatch.setupSubscriptions()
  }
  ignorePromise(f())
}

// extracts the payload from pages used in routing
export type PagesToParams<T> = {
  [K in keyof T]: T[K] extends {screen: infer U}
    ? U extends (args: infer V) => any
      ? V extends {route: {params: infer W}}
        ? W
        : undefined
      : undefined
    : undefined
}

// get the views params and wrap them as the page would see it
export type ViewPropsToPageProps<T> =
  T extends React.LazyExoticComponent<infer C>
    ? C extends React.ComponentType<infer P>
      ? P extends undefined | never
        ? {route: {params?: undefined}}
        : {route: {params: P}}
      : {route: {params?: undefined}}
    : T extends (p: infer P) => any
      ? P extends undefined | never
        ? {route: {params?: undefined}}
        : {route: {params: P}}
      : {route: {params?: undefined}}
export type ViewPropsToPagePropsMaybe<T> = T extends (p: infer P) => any
  ? {route: {params: P | undefined}}
  : never

import logger from '@/logger'
export {default as logger} from '@/logger'
export {debugWarning} from '@/util/debug-warning'

export const ignorePromise = (f: Promise<void> | Promise<PromiseSettledResult<void>[]>) => {
  f.then(() => {}).catch((e: unknown) => {
    // likely remove this after some time
    logger.error('ignorePromise error', e)
  })
}

export const timeoutPromise = async (timeMs: number) =>
  new Promise<void>(resolve => {
    setTimeout(() => resolve(), timeMs)
  })

export async function neverThrowPromiseFunc<T>(f: () => Promise<T>) {
  try {
    return await f()
  } catch {
    return undefined
  }
}

export function enumKeys<T extends Record<string, string | number>>(enumeration: T): (keyof T)[] {
  return Object.keys(enumeration).filter(key => typeof enumeration[key] === 'number') as (keyof T)[]
}

export const assertNever = (_: never) => undefined

import {useNavigation} from '@react-navigation/core'
import {type RouteKeys} from '@/router-v2/route-params'
export const useNav = () => {
  const na = useNavigation()
  const {canGoBack} = na
  const pop: undefined | (() => void) = canGoBack() ? na.goBack : undefined
  const navigate: (n: RouteKeys) => void = na.navigate
  return {
    canGoBack,
    navigate,
    pop,
  }
}

export {useIsMounted, useOnMountOnce, useOnUnMountOnce, useEvent, useLogMount} from './react'
export {useDebouncedCallback, useThrottledCallback, type DebouncedState} from 'use-debounce'
export {useShallow, useDeep} from '@/util/zustand'
export {isNetworkErr, RPCError} from '@/util/errors'
export {default as useRPC} from '@/util/use-rpc'
export {fixCrop} from '@/util/crop'
export {produce} from 'immer'
export * from './immer'
export {default as featureFlags} from '../util/feature-flags'
