export * from './platform'
export {wrapErrors} from '@/util/debug'

import type * as Active from './active'
export declare const useActiveState: typeof Active.useState_

import type * as Archive from './archive'
export declare const useArchiveState: typeof Archive.useState_

import type * as AutoResetT from './autoreset'
export declare const useAutoResetState: typeof AutoResetT.useState_
export declare const AutoReset: typeof AutoResetT

import type * as BotsT from './bots'
export declare const useBotsState: typeof BotsT.useState_
export declare const Bots: typeof BotsT

import type * as Chat2T from './chat2'
export declare const useChatState: typeof Chat2T.useState_
export declare const Chat: typeof Chat2T
export declare const useConvoState: typeof Chat2T.useConvoState_
export declare const chatStores: typeof Chat2T.stores_
export declare const ChatProvider: typeof Chat2T.ChatProvider_
export declare const getConvoState: typeof Chat2T.getConvoState_
export declare const useChatContext: typeof Chat2T.useContext_

import type * as ConfigT from './config'
export declare const useConfigState: typeof ConfigT.useConfigState_
export declare const Config: typeof ConfigT

import type * as CryptoT from './crypto'
export declare const useCryptoState: typeof CryptoT.useState_
export declare const Crypto: typeof CryptoT

import type * as CurrentUser from './current-user'
export declare const useCurrentUserState: typeof CurrentUser.useState_

import type * as DaemonT from './daemon'
export declare const useDaemonState: typeof DaemonT.useState_
export declare const maxHandshakeTries: typeof DaemonT.maxHandshakeTries

import type * as DarkMode from './darkmode'
export declare const useDarkModeState: typeof DarkMode.useState_

import type * as DeepLinksT from './deeplinks'
export declare const useDeepLinksState: typeof DeepLinksT.useState_
export declare const DeepLinks: typeof DeepLinksT

import type * as DevicesT from './devices'
export declare const useDevicesState: typeof DevicesT.useState_
export declare const Devices: typeof DevicesT

import type * as Engine from './engine'
export declare const useEngineState: typeof Engine.useState_

import type * as Followers from './followers'
export declare const useFollowerState: typeof Followers.useState_

import type * as FST from './fs'
export declare const useFSState: typeof FST.useState_
export declare const FS: typeof FST

import type * as GitT from './git'
export declare const useGitState: typeof GitT.useState_
export declare const Git: typeof GitT

import type * as GregorT from './gregor'
export declare const Gregor: typeof GregorT

import type * as Logout from './logout'
export declare const useLogoutState: typeof Logout.useState_

import type * as Notifications from './notifications'
export declare const useNotifState: typeof Notifications.useState_

import type * as PeopleT from './people'
export declare const usePeopleState: typeof PeopleT.useState_
export declare const People: typeof PeopleT

import type * as Pinentry from './pinentry'
export declare const usePinentryState: typeof Pinentry.useState_

import type * as ProfileT from './profile'
export declare const useProfileState: typeof ProfileT.useState_
export declare const Profile: typeof ProfileT

import type * as ProvisionT from './provision'
export declare const useProvisionState: typeof ProvisionT.useState_
export declare const Provision: typeof ProvisionT

import type * as PushT from './push'
export declare const usePushState: typeof PushT.useState_
export declare const Push: typeof PushT

import type * as RecoverPwdT from './recover-password'
export declare const useRecoverState: typeof RecoverPwdT.useState_
export declare const RecoverPwd: typeof RecoverPwdT

import type * as Router2T from './router2'
export declare const useRouterState: typeof Router2T.useState_
export declare const makeScreen: typeof Router2T.makeScreen
export declare const Router2: typeof Router2T

import type * as SettingsT from './settings'
export declare const Settings: typeof SettingsT
export declare const useSettingsState: typeof SettingsT.useState_

import type * as SettingsChatT from './settings-chat'
export declare const useSettingsChatState: typeof SettingsChatT.useState_
export declare const SettingsChat: typeof SettingsChatT

import type * as SettingsContacts from './settings-contacts'
export declare const useSettingsContactsState: typeof SettingsContacts.useState_
export declare const importContactsWaitingKey: typeof SettingsContacts.importContactsWaitingKey

import type * as SettingsEmail from './settings-email'
export declare const useSettingsEmailState: typeof SettingsEmail.useState_
export declare const addEmailWaitingKey: typeof SettingsEmail.addEmailWaitingKey

import type * as SettingsInvites from './settings-invites'
export declare const useSettingsInvitesState: typeof SettingsInvites.useState_

import type * as SettingsNotifications from './settings-notifications'
export declare const useSettingsNotifState: typeof SettingsNotifications.useState_
export declare const refreshNotificationsWaitingKey: typeof SettingsNotifications.refreshNotificationsWaitingKey

import type * as SettingsPassword from './settings-password'
export declare const useSettingsPasswordState: typeof SettingsPassword.useState_

import type * as SettingsPhoneT from './settings-phone'
export declare const SettingsPhone: typeof SettingsPhoneT
export declare const useSettingsPhoneState: typeof SettingsPhoneT.useState_

import type * as SignupT from './signup'
export declare const useSignupState: typeof SignupT.useState_
export declare const Signup: typeof SignupT

import type * as TabsT from './tabs'
export declare const Tabs: typeof TabsT

import type * as TeamBuildingT from './team-building'
export declare const TBProvider: typeof TeamBuildingT.TBProvider_
export declare const TBstores: typeof TeamBuildingT.stores_
export declare const useTBContext: typeof TeamBuildingT.useContext_
export declare const TeamBuilding: typeof TeamBuildingT

import type * as TeamsT from './teams'
export declare const useTeamsState: typeof TeamsT.useState_
export declare const Teams: typeof TeamsT

import type * as TrackerT from './tracker2'
export declare const useTrackerState: typeof TrackerT.useState_
export declare const Tracker: typeof TrackerT

import type * as UnlockFolders from './unlock-folders'
export declare const useUFState: typeof UnlockFolders.useState_

import type * as UsersT from './users'
export declare const useUsersState: typeof UsersT.useState_
export declare const Users: typeof UsersT

import type * as WaitingT from './waiting'
export declare const useWaitingState: typeof WaitingT.useState_
export declare const Waiting: typeof WaitingT

import type * as WalletsT from './wallets'
export declare const Wallets: typeof WalletsT
export declare const useWalletsState: typeof WalletsT.useState_

import type * as WhatsNew from './whats-new'
export declare const useWNState: typeof WhatsNew.useState_

export {default as shallowEqual} from 'shallowequal'
export * as PlatformSpecific from './platform-specific'

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
export declare const timeoutPromise: (timeMs: number) => Promise<unknown>
export declare function neverThrowPromiseFunc<T>(f: () => Promise<T>): Promise<T | undefined>
export declare function enumKeys<T extends Record<string, string | number>>(enumeration: T): (keyof T)[]
export declare const assertNever: (_: unknown) => undefined
export declare const useNav: () => {canGoBack: boolean; navigate: any; pop: (() => void) | undefined}

export {useIsMounted, useOnMountOnce, useOnUnMountOnce, useEvent, useLogMount} from './react'
export {useDebouncedCallback, useThrottledCallback} from 'use-debounce'
export {useShallow, useDeep} from '@/util/zustand'
export {isNetworkErr, RPCError} from '@/util/errors'
export {default as useRPC} from '@/util/use-rpc'
export {fixCrop} from '@/util/crop'
export {produce} from 'immer'
export * from './immer'
export {default as featureFlags} from '../util/feature-flags'

