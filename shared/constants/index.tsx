/* eslint-disable @typescript-eslint/no-unsafe-return,@typescript-eslint/no-unsafe-member-access */

export * from './platform'
export {wrapErrors} from '@/util/debug'

import type * as Active from './active'
export declare const useActiveState: typeof Active.useState_
Object.defineProperty(exports, 'useActiveState', {get: () => require('./active').useState_})

import type * as Archive from './archive'
export declare const useArchiveState: typeof Archive.useState_
Object.defineProperty(exports, 'useArchiveState', {get: () => require('./archive').useState_})

import type * as AutoResetT from './autoreset'
export declare const useAutoResetState: typeof AutoResetT.useState_
export declare const AutoReset: typeof AutoResetT
Object.defineProperty(exports, 'useAutoResetState', {get: () => require('./autoreset').useState_})
Object.defineProperty(exports, 'AutoReset', {get: () => require('./autoreset')})

import type * as BotsT from './bots'
export declare const useBotsState: typeof BotsT.useState_
export declare const Bots: typeof BotsT
Object.defineProperty(exports, 'useBotsState', {get: () => require('./bots').useState_})
Object.defineProperty(exports, 'Bots', {get: () => require('./bots')})

import type * as Chat2T from './chat2'
export declare const useChatState: typeof Chat2T.useState_
export declare const Chat: typeof Chat2T
export declare const useConvoState: typeof Chat2T.useConvoState_
export declare const chatStores: typeof Chat2T.stores_
export declare const ChatProvider: typeof Chat2T.ChatProvider_
export declare const getConvoState: typeof Chat2T.getConvoState_
export declare const useChatContext: typeof Chat2T.useContext_
Object.defineProperty(exports, 'useChatState', {get: () => require('./chat2').useState_})
Object.defineProperty(exports, 'Chat', {get: () => require('./chat2')})
Object.defineProperty(exports, 'useConvoState', {get: () => require('./chat2').useConvoState_})
Object.defineProperty(exports, 'chatStores', {get: () => require('./chat2').stores_})
Object.defineProperty(exports, 'ChatProvider', {get: () => require('./chat2').ChatProvider_})
Object.defineProperty(exports, 'getConvoState', {get: () => require('./chat2').getConvoState_})
Object.defineProperty(exports, 'useChatContext', {get: () => require('./chat2').useContext_})

import type * as ConfigT from './config'
export declare const useConfigState: typeof ConfigT.useConfigState_
export declare const Config: typeof ConfigT
Object.defineProperty(exports, 'useConfigState', {get: () => require('./config').useConfigState_})
Object.defineProperty(exports, 'Config', {get: () => require('./config')})

import type * as CryptoT from './crypto'
export declare const useCryptoState: typeof CryptoT.useState_
export declare const Crypto: typeof CryptoT
Object.defineProperty(exports, 'useCryptoState', {get: () => require('./crypto').useState_})
Object.defineProperty(exports, 'Crypto', {get: () => require('./crypto')})

import type * as CurrentUser from './current-user'
export declare const useCurrentUserState: typeof CurrentUser.useState_
Object.defineProperty(exports, 'useCurrentUserState', {get: () => require('./current-user').useState_})

import type * as DaemonT from './daemon'
export declare const useDaemonState: typeof DaemonT.useState_
export declare const maxHandshakeTries: typeof DaemonT.maxHandshakeTries
Object.defineProperty(exports, 'useDaemonState', {get: () => require('./daemon').useState_})
Object.defineProperty(exports, 'maxHandshakeTries', {get: () => require('./daemon').maxHandshakeTries})

import type * as DarkMode from './darkmode'
export declare const useDarkModeState: typeof DarkMode.useState_
Object.defineProperty(exports, 'useDarkModeState', {get: () => require('./darkmode').useState_})

import type * as DeepLinksT from './deeplinks'
export declare const useDeepLinksState: typeof DeepLinksT.useState_
export declare const DeepLinks: typeof DeepLinksT
Object.defineProperty(exports, 'useDeepLinksState', {get: () => require('./deeplinks').useState_})
Object.defineProperty(exports, 'DeepLinks', {get: () => require('./deeplinks')})

import type * as DevicesT from './devices'
export declare const useDevicesState: typeof DevicesT.useState_
export declare const Devices: typeof DevicesT
Object.defineProperty(exports, 'useDevicesState', {get: () => require('./devices').useState_})
Object.defineProperty(exports, 'Devices', {get: () => require('./devices')})

import type * as Engine from './engine'
export declare const useEngineState: typeof Engine.useState_
Object.defineProperty(exports, 'useEngineState', {get: () => require('./engine').useState_})

import type * as Followers from './followers'
export declare const useFollowerState: typeof Followers.useState_
Object.defineProperty(exports, 'useFollowerState', {get: () => require('./followers').useState_})

import type * as FST from './fs'
export declare const useFSState: typeof FST.useState_
export declare const FS: typeof FST
Object.defineProperty(exports, 'useFSState', {get: () => require('./fs').useState_})
Object.defineProperty(exports, 'FS', {get: () => require('./fs')})

import type * as GitT from './git'
export declare const useGitState: typeof GitT.useState_
export declare const Git: typeof GitT
Object.defineProperty(exports, 'useGitState', {get: () => require('./git').useState_})
Object.defineProperty(exports, 'Git', {get: () => require('./git')})

import type * as GregorT from './gregor'
export declare const Gregor: typeof GregorT
Object.defineProperty(exports, 'Gregor', {get: () => require('./gregor')})

import type * as Logout from './logout'
export declare const useLogoutState: typeof Logout.useState_
Object.defineProperty(exports, 'useLogoutState', {get: () => require('./logout').useState_})

import type * as Notifications from './notifications'
export declare const useNotifState: typeof Notifications.useState_
Object.defineProperty(exports, 'useNotifState', {get: () => require('./notifications').useState_})

import type * as PeopleT from './people'
export declare const usePeopleState: typeof PeopleT.useState_
export declare const People: typeof PeopleT
Object.defineProperty(exports, 'usePeopleState', {get: () => require('./people').useState_})
Object.defineProperty(exports, 'People', {get: () => require('./people')})

import type * as Pinentry from './pinentry'
export declare const usePinentryState: typeof Pinentry.useState_
Object.defineProperty(exports, 'usePinentryState', {get: () => require('./pinentry').useState_})

import type * as ProfileT from './profile'
export declare const useProfileState: typeof ProfileT.useState_
export declare const Profile: typeof ProfileT
Object.defineProperty(exports, 'useProfileState', {get: () => require('./profile').useState_})
Object.defineProperty(exports, 'Profile', {get: () => require('./profile')})

import type * as ProvisionT from './provision'
export declare const useProvisionState: typeof ProvisionT.useState_
export declare const Provision: typeof ProvisionT
Object.defineProperty(exports, 'useProvisionState', {get: () => require('./provision').useState_})
Object.defineProperty(exports, 'Provision', {get: () => require('./provision')})

import type * as PushT from './push'
export declare const usePushState: typeof PushT.useState_
export declare const Push: typeof PushT
Object.defineProperty(exports, 'usePushState', {get: () => require('./push').useState_})
Object.defineProperty(exports, 'Push', {get: () => require('./push')})

import type * as RecoverPwdT from './recover-password'
export declare const useRecoverState: typeof RecoverPwdT.useState_
export declare const RecoverPwd: typeof RecoverPwdT
Object.defineProperty(exports, 'useRecoverState', {get: () => require('./recover-password').useState_})
Object.defineProperty(exports, 'RecoverPwd', {get: () => require('./recover-password')})

import type * as Router2T from './router2'
export declare const useRouterState: typeof Router2T.useState_
export declare const makeScreen: typeof Router2T.makeScreen
export declare const Router2: typeof Router2T
Object.defineProperty(exports, 'useRouterState', {get: () => require('./router2').useState_})
Object.defineProperty(exports, 'makeScreen', {get: () => require('./router2').makeScreen})
Object.defineProperty(exports, 'Router2', {get: () => require('./router2')})

import type * as SettingsT from './settings'
export declare const Settings: typeof SettingsT
export declare const useSettingsState: typeof SettingsT.useState_
Object.defineProperty(exports, 'Settings', {get: () => require('./settings')})
Object.defineProperty(exports, 'useSettingsState', {get: () => require('./settings').useState_})

import type * as SettingsChatT from './settings-chat'
export declare const useSettingsChatState: typeof SettingsChatT.useState_
export declare const SettingsChat: typeof SettingsChatT
Object.defineProperty(exports, 'useSettingsChatState', {get: () => require('./settings-chat').useState_})
Object.defineProperty(exports, 'SettingsChat', {get: () => require('./settings-chat')})

import type * as SettingsContacts from './settings-contacts'
export declare const useSettingsContactsState: typeof SettingsContacts.useState_
export declare const importContactsWaitingKey: typeof SettingsContacts.importContactsWaitingKey
Object.defineProperty(exports, 'useSettingsContactsState', {
  get: () => require('./settings-contacts').useState_,
})
Object.defineProperty(exports, 'importContactsWaitingKey', {
  get: () => require('./settings-contacts').importContactsWaitingKey,
})

import type * as SettingsEmail from './settings-email'
export declare const useSettingsEmailState: typeof SettingsEmail.useState_
export declare const addEmailWaitingKey: typeof SettingsEmail.addEmailWaitingKey
Object.defineProperty(exports, 'useSettingsEmailState', {get: () => require('./settings-email').useState_})
Object.defineProperty(exports, 'addEmailWaitingKey', {
  get: () => require('./settings-email').addEmailWaitingKey,
})

import type * as SettingsInvites from './settings-invites'
export declare const useSettingsInvitesState: typeof SettingsInvites.useState_
Object.defineProperty(exports, 'useSettingsInvitesState', {
  get: () => require('./settings-invites').useState_,
})

import type * as SettingsNotifications from './settings-notifications'
export declare const useSettingsNotifState: typeof SettingsNotifications.useState_
export declare const refreshNotificationsWaitingKey: typeof SettingsNotifications.refreshNotificationsWaitingKey
Object.defineProperty(exports, 'useSettingsNotifState', {
  get: () => require('./settings-notifications').useState_,
})
Object.defineProperty(exports, 'refreshNotificationsWaitingKey', {
  get: () => require('./settings-notifications').refreshNotificationsWaitingKey,
})

import type * as SettingsPassword from './settings-password'
export declare const useSettingsPasswordState: typeof SettingsPassword.useState_
Object.defineProperty(exports, 'useSettingsPasswordState', {
  get: () => require('./settings-password').useState_,
})

import type * as SettingsPhoneT from './settings-phone'
export declare const SettingsPhone: typeof SettingsPhoneT
export declare const useSettingsPhoneState: typeof SettingsPhoneT.useState_
Object.defineProperty(exports, 'SettingsPhone', {get: () => require('./settings-phone')})
Object.defineProperty(exports, 'useSettingsPhoneState', {get: () => require('./settings-phone').useState_})

import type * as SignupT from './signup'
export declare const useSignupState: typeof SignupT.useState_
export declare const Signup: typeof SignupT
Object.defineProperty(exports, 'useSignupState', {get: () => require('./signup').useState_})
Object.defineProperty(exports, 'Signup', {get: () => require('./signup')})

import type * as TabsT from './tabs'
export declare const Tabs: typeof TabsT
Object.defineProperty(exports, 'Tabs', {get: () => require('./tabs')})

import type * as TeamBuildingT from './team-building'
export declare const TBProvider: typeof TeamBuildingT.TBProvider_
export declare const TBstores: typeof TeamBuildingT.stores_
export declare const useTBContext: typeof TeamBuildingT.useContext_
export declare const TeamBuilding: typeof TeamBuildingT
Object.defineProperty(exports, 'TBProvider', {get: () => require('./team-building').TBProvider_})
Object.defineProperty(exports, 'TBstores', {get: () => require('./team-building').stores_})
Object.defineProperty(exports, 'useTBContext', {get: () => require('./team-building').useContext_})
Object.defineProperty(exports, 'TeamBuilding', {get: () => require('./team-building')})

import type * as TeamsT from './teams'
export declare const useTeamsState: typeof TeamsT.useState_
export declare const Teams: typeof TeamsT
Object.defineProperty(exports, 'useTeamsState', {get: () => require('./teams').useState_})
Object.defineProperty(exports, 'Teams', {get: () => require('./teams')})

import type * as TrackerT from './tracker2'
export declare const useTrackerState: typeof TrackerT.useState_
export declare const Tracker: typeof TrackerT
Object.defineProperty(exports, 'useTrackerState', {get: () => require('./tracker2').useState_})
Object.defineProperty(exports, 'Tracker', {get: () => require('./tracker2')})

import type * as UnlockFolders from './unlock-folders'
export declare const useUFState: typeof UnlockFolders.useState_
Object.defineProperty(exports, 'useUFState', {get: () => require('./unlock-folders').useState_})

import type * as UsersT from './users'
export declare const useUsersState: typeof UsersT.useState_
export declare const Users: typeof UsersT
Object.defineProperty(exports, 'useUsersState', {get: () => require('./users').useState_})
Object.defineProperty(exports, 'Users', {get: () => require('./users')})

import type * as WaitingT from './waiting'
export declare const useWaitingState: typeof WaitingT.useState_
export declare const Waiting: typeof WaitingT
Object.defineProperty(exports, 'useWaitingState', {get: () => require('./waiting').useState_})
Object.defineProperty(exports, 'Waiting', {get: () => require('./waiting')})

import type * as WalletsT from './wallets'
export declare const Wallets: typeof WalletsT
export declare const useWalletsState: typeof WalletsT.useState_
Object.defineProperty(exports, 'Wallets', {get: () => require('./wallets')})
Object.defineProperty(exports, 'useWalletsState', {get: () => require('./wallets').useState_})

import type * as WhatsNew from './whats-new'
export declare const useWNState: typeof WhatsNew.useState_
Object.defineProperty(exports, 'useWNState', {get: () => require('./whats-new').useState_})

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
  f.then(() => {}).catch(e => {
    logger.error('ignorePromise error', e)
  })
}

export const timeoutPromise = async (timeMs: number) =>
  new Promise(resolve => {
    setTimeout(() => resolve(undefined), timeMs)
  })

export async function neverThrowPromiseFunc<T>(f: () => Promise<T>) {
  try {
    return await f()
  } catch {
    return undefined
  }
}

export function enumKeys<T extends Record<string, string | number>>(enumeration: T): (keyof T)[] {
  return Object.keys(enumeration).filter(key => typeof enumeration[key] === 'number')
}

export const assertNever = (_: unknown) => undefined

import {useNavigation} from '@react-navigation/core'
export const useNav = () => {
  const na = useNavigation()
  const {canGoBack} = na
  const pop = canGoBack() ? na.goBack : undefined
  const navigate = na.navigate
  return {
    canGoBack,
    navigate,
    pop,
  }
}

export {useIsMounted, useOnMountOnce, useOnUnMountOnce, useEvent, useLogMount} from './react'
export {useDebouncedCallback, useThrottledCallback} from 'use-debounce'
export {useShallow, useDeep} from '@/util/zustand'
export {isNetworkErr, RPCError} from '@/util/errors'
export {default as useRPC} from '@/util/use-rpc'
export {fixCrop} from '@/util/crop'
export {produce} from 'immer'
export * from './immer'
export {default as featureFlags} from '../util/feature-flags'
