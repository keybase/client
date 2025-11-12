// Used to avoid circular dependencies, keep orders
export * from './platform'
export {wrapErrors} from '@/util/debug'
export {useState_ as useDarkModeState} from './darkmode'
export {useState_ as useRouterState, makeScreen} from './router2'
export * as Router2 from './router2'
export {useState_ as useDeepLinksState} from './deeplinks'
export * as DeepLinks from './deeplinks'
export {TBProvider_ as TBProvider, stores_ as TBstores, useContext_ as useTBContext} from './team-building'
export * as TeamBuilding from './team-building'
export {useState_ as useGitState} from './git'
export * as Git from './git'
export {useState_ as useProvisionState} from './provision'
export * as Provision from './provision'
export {useState_ as useActiveState} from './active'
export {useState_ as useAutoResetState} from './autoreset'
export * as AutoReset from './autoreset'
export {useState_ as useBotsState} from './bots'
export * as Bots from './bots'
export {useState_ as useCryptoState} from './crypto'
export * as Crypto from './crypto'
export {useState_ as useCurrentUserState} from './current-user'
export {useState_ as useDaemonState, maxHandshakeTries} from './daemon'
export {useState_ as useDevicesState} from './devices'
export * as Devices from './devices'
export {useState_ as useEngineState} from './engine'
export {useState_ as useFollowerState} from './followers'
export * as Gregor from './gregor'
export {useState_ as useLogoutState} from './logout'
export {useState_ as useNotifState} from './notifications'
export {useState_ as usePeopleState} from './people'
export * as People from './people'
export {useState_ as usePinentryState} from './pinentry'
export {useState_ as useProfileState} from './profile'
export * as Profile from './profile'
export {useState_ as usePushState} from './push'
export * as Push from './push'
export {useState_ as useRecoverState} from './recover-password'
export * as RecoverPwd from './recover-password'
export * as Settings from './settings'
export {useState_ as useSettingsState} from './settings'
export {useState_ as useFSState} from './fs'
export * as FS from './fs'
export * as Tabs from './tabs'
export {useState_ as useSettingsChatState} from './settings-chat'
export * as SettingsChat from './settings-chat'
export * as SettingsPhone from './settings-phone'
export {useState_ as useSettingsPhoneState} from './settings-phone'
export {useState_ as useSettingsEmailState, addEmailWaitingKey} from './settings-email'
export {useState_ as useSettingsPasswordState} from './settings-password'
export {useState_ as useSettingsInvitesState} from './settings-invites'
export {useState_ as useSettingsNotifState, refreshNotificationsWaitingKey} from './settings-notifications'
export {useState_ as useSettingsContactsState, importContactsWaitingKey} from './settings-contacts'
export {useState_ as useSignupState} from './signup'
export * as Signup from './signup'
export {useState_ as useTeamsState} from './teams'
export * as Teams from './teams'
export {useState_ as useTrackerState} from './tracker2'
export * as Tracker from './tracker2'
export {useState_ as useUFState} from './unlock-folders'
export {useState_ as useUsersState} from './users'
export {useState_ as useWaitingState} from './waiting'
export * as Waiting from './waiting'
export * as Wallets from './wallets'
export {useState_ as useWalletsState} from './wallets'
export {useState_ as useWNState} from './whats-new'
export {useState_ as useChatState} from './chat2'
export * as Chat from './chat2'
export {useConvoState_ as useConvoState, stores_ as chatStores, ChatProvider_ as ChatProvider} from './chat2'
export {getConvoState_ as getConvoState, useContext_ as useChatContext} from './chat2'
export {useConfigState_ as useConfigState, type Store as ConfigStore} from './config'
export * as Config from './config'
export {useState_ as useArchiveState} from './archive'
import {useState_ as useFSState} from './fs'
import {useConfigState_ as useConfigState} from './config'

export {default as shallowEqual} from 'shallowequal'
export * as PlatformSpecific from './platform-specific'

export const initListeners = () => {
  const f = async () => {
    await useFSState.getState().dispatch.setupSubscriptions()
    useConfigState.getState().dispatch.setupSubscriptions()
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
export type ViewPropsToPageProps<T> = T extends React.LazyExoticComponent<infer C>
  ? C extends React.ComponentType<infer P>
    ? P extends undefined | Record<string, never> | {} | never
      ? {route: {params?: undefined}}
      : {route: {params: P}}
    : {route: {params?: undefined}}
  : T extends (p: infer P) => any
    ? P extends undefined | Record<string, never> | {} | never
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
