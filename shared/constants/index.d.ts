// Type definitions for index.js
export * from './platform'
export {wrapErrors} from '@/util/debug'

export type {useState_ as useDarkModeState} from './darkmode'
export type {useState_ as useRouterState, makeScreen} from './router2'
export type * as Router2 from './router2'
export type {useState_ as useDeepLinksState} from './deeplinks'
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
export type {useState_ as useDaemonState, maxHandshakeTries} from './daemon'
export type {useState_ as useDevicesState} from './devices'
export type * as Devices from './devices'
export type {useState_ as useEngineState} from './engine'
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
export type {useState_ as useWaitingState} from './waiting'
export type * as Waiting from './waiting'
export type * as Wallets from './wallets'
export type {useState_ as useWalletsState} from './wallets'
export type {useState_ as useWNState} from './whats-new'
export type {useState_ as useChatState} from './chat2'
export type * as Chat from './chat2'
export type {useConvoState_ as useConvoState, stores_ as chatStores, ChatProvider_ as ChatProvider} from './chat2'
export type {getConvoState_ as getConvoState, useContext_ as useChatContext} from './chat2'
export type {useConfigState_ as useConfigState, type Store as ConfigStore} from './config'
export type * as Config from './config'
export type {useState_ as useArchiveState} from './archive'

export {default as shallowEqual} from 'shallowequal'
export type * as PlatformSpecific from './platform-specific'

export declare const initListeners: () => void

export type PagesToParams<T> = {
  [K in keyof T]: T[K] extends {screen: infer U}
    ? U extends (args: infer V) => any
      ? V extends {route: {params: infer W}}
        ? W
        : undefined
      : undefined
    : undefined
}

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

export {default as logger} from '@/logger'
export {debugWarning} from '@/util/debug-warning'

export declare const ignorePromise: (f: Promise<void> | Promise<PromiseSettledResult<void>[]>) => void
export declare const timeoutPromise: (timeMs: number) => Promise<void>
export declare function neverThrowPromiseFunc<T>(f: () => Promise<T>): Promise<T | undefined>
export declare function enumKeys<T extends Record<string, string | number>>(enumeration: T): (keyof T)[]
export declare const assertNever: (_: never) => undefined

import {type RouteKeys} from '@/router-v2/route-params'
export declare const useNav: () => {
  canGoBack: boolean
  navigate: (n: RouteKeys) => void
  pop: (() => void) | undefined
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


