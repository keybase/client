// Used to avoid circular dependencies, keep orders
export * from './platform'
export {_useState as useDarkModeState} from './darkmode'
export {_useState as useRouterState} from './router2'
export * as Router2 from './router2'
export {_useState as useDeepLinksState} from './deeplinks'
export * as DeepLinks from './deeplinks'
export {_Provider as TBProvider, _stores as TBstores, _useContext as useTBContext} from './team-building'
export * as TeamBuilding from './team-building'
export {_useState as useGitState} from './git'
export * as Git from './git'
export {_useState as useProvisionState} from './provision'
export * as Provision from './provision'
export {_useState as useFSState} from './fs'
export * as FS from './fs'
export {_useState as useActiveState} from './active'
export {_useState as useAutoResetState} from './autoreset'
export * as AutoReset from './autoreset'
export {_useState as useBotsState, getFeaturedSorted} from './bots'
export {waitingKeyBotSearchUsers, waitingKeyBotSearchFeatured} from './bots'
export {_useState as useCryptoState} from './crypto'
import * as Crypto from './crypto'
export {Crypto}
export {_useState as useCurrentUserState} from './current-user'
export {_useState as useDaemonState, maxHandshakeTries} from './daemon'
export {_useState as useDevicesState, waitingKey as devicesWaitingKey} from './devices'
export {_useState as useEngineState} from './engine'
export {_useState as useFollowerState} from './followers'
export {bodyToJSON} from './gregor'
export {_useState as useLogoutState} from './logout'
export {_useState as useNotifState} from './notifications'
export {_useState as usePeopleState, getPeopleDataWaitingKey, todoTypes} from './people'
export {_useState as usePinentryState} from './pinentry'
export {_useState as useProfileState} from './profile'
export {uploadAvatarWaitingKey, waitingKey as profileWaitingKey} from './profile'
export {_useState as usePushState, permissionsRequestingWaitingKey} from './push'
export {_useState as useRecoverState, waitingKey as recoverWaitingKey} from './recover-password'
export * as Settings from './settings'
export {_useState as useSettingsState} from './settings'
export * as Tabs from './tabs'
export {_useState as useSettingsChatState, contactSettingsSaveWaitingKey} from './settings-chat'
export {chatUnfurlWaitingKey, contactSettingsLoadWaitingKey} from './settings-chat'
export {resendVerificationForPhoneWaitingKey, verifyPhoneNumberWaitingKey} from './settings-phone'
export {_useState as useSettingsPhoneState, getE164, addPhoneNumberWaitingKey} from './settings-phone'
export {_useState as useSettingsEmailState, addEmailWaitingKey} from './settings-email'
export {_useState as useSettingsPasswordState} from './settings-password'
export {_useState as useSettingsInvitesState} from './settings-invites'
export {_useState as useSettingsNotifState, refreshNotificationsWaitingKey} from './settings-notifications'
export {_useState as useSettingsContactsState, importContactsWaitingKey} from './settings-contacts'
export {_useState as useSignupState, waitingKey as signupWaitingKey} from './signup'
export {maxUsernameLength, defaultDevicename} from './signup'
export {_useState as useTeamsState, teamWaitingKey} from './teams'
export {getCanPerformByID, getTeamNameFromID, teamRoleByEnum} from './teams'
export * as Teams from './teams'
export {_useState as useTrackerState} from './tracker2'
export * as Tracker from './tracker2'
export {_useState as useUFState} from './unlock-folders'
export {_useState as useUsersState} from './users'
export {_useState as useWaitingState, useAnyWaiting, useAnyErrors, useDispatchClearWaiting} from './waiting'
export * as Wallets from './wallets'
export {_useState as useWalletsState} from './wallets'
export {_useState as useWNState} from './whats-new'
export {_useState as useChatState, type ChatProviderProps} from './chat2'
export * as Chat from './chat2'
export {_useConvoState as useConvoState, _stores as chatStores, _Provider as ChatProvider} from './chat2'
export {_getConvoState as getConvoState, _useContext as useChatContext} from './chat2'
export {_useConfigState as useConfigState, type Store as ConfigStore} from './config'
import * as Config from './config'
export {Config}
export {createOtherAccountWaitingKey} from './config'
export {default as shallowEqual} from 'shallowequal'
import {_useState as useFSState} from './fs'
import {_useConfigState as useConfigState} from './config'

import * as PlatformSpecific from './platform-specific'
export {PlatformSpecific}

export const initListeners = () => {
  useFSState.getState().dispatch.setupSubscriptions()
  useConfigState.getState().dispatch.setupSubscriptions()
}

// extracts the payload from pages used in routing
export type PagesToParams<T> = {
  [K in keyof T]: T[K] extends {getScreen: infer U}
    ? U extends () => (args: infer V) => any
      ? V extends {route: {params: infer W}}
        ? W
        : undefined
      : undefined
    : undefined
}

// get the views params and wrap them as the page would see it
export type ViewPropsToPageProps<T> = T extends (p: infer P) => any ? {route: {params: P}} : never
export type ViewPropsToPagePropsMaybe<T> = T extends (p: infer P) => any
  ? {route: {params: P | undefined}}
  : never

export const ignorePromise = (f: Promise<void>) => {
  f.then(() => {}).catch(() => {})
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

export const assertNever = (_: never) => undefined

import {useNavigation} from '@react-navigation/core'
import {type RouteKeys} from '@/router-v2/route-params'
export const useNav = () => {
  const n = useNavigation()
  const na: {pop?: () => void; navigate: (n: RouteKeys) => void} = n as any
  const {canGoBack} = n
  const pop: undefined | (() => void) = canGoBack() ? na.pop : undefined
  const navigate: (n: RouteKeys) => void = na.navigate
  return {
    canGoBack,
    navigate,
    pop,
  }
}

export {useIsMounted, useOnMountOnce, useOnUnMountOnce, useEvent} from './react'
export {useDebouncedCallback, useThrottledCallback, type DebouncedState} from 'use-debounce'
export {useShallow, useDeep} from '@/util/zustand'
export {isNetworkErr, RPCError} from '@/util/errors'
export {default as useRPC} from '@/util/use-rpc'
export {default as useSafeCallback} from '@/util/use-safe-callback'
export {produce} from 'immer'
export * from './immer'
