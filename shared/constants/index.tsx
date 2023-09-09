// Used to avoid circular dependencies, keep orders
import * as React from 'react'
export * from './platform'
export {_useState as useDarkModeState} from './darkmode'
export {_useState as useRouterState, getModalStack, getTab} from './router2'
export {_getNavigator as getNavigator, navigationRef_, getVisibleScreen} from './router2'
export {getVisiblePath, navToThread, type PathParam} from './router2'
export {_useState as useDeepLinksState, linkFromConvAndMessage} from './deeplinks'
export {_Provider as TBProvider, _stores as TBstores, _useContext as useTBContext} from './team-building'
export {searchWaitingKey as tbSearchWaitingKey} from './team-building'
export {_useState as useGitState, loadingWaitingKey as gitWaitingKey, makeGitInfo} from './git'
export {_useState as useProvisionState, waitingKey as provisionWaitingKey} from './provision'
export {type Device as ProvisionDevice, forgotUsernameWaitingKey} from './provision'
export {_useState as useFSState, makeActionForOpenPathInFilesTab, emptyFileContext, defaultPath} from './fs'
export {getPathItem, humanReadableFileSize, getTlfFromPath, parsePath, syncToggleWaitingKey} from './fs'
export {isFolder, makeActionsForDestinationPickerOpen, isTeamPath, pathTypeToTextType} from './fs'
export {_useState as useActiveState} from './active'
export {_useState as useAutoResetState, enterPipelineWaitingKey} from './autoreset'
export {actuallyResetWaitingKey, cancelResetWaitingKey} from './autoreset'
export {_useState as useBotsState, getFeaturedSorted} from './bots'
export {waitingKeyBotSearchUsers, waitingKeyBotSearchFeatured} from './bots'
export {_useState as useCryptoState} from './crypto'
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
export {settingsAccountTab, settingsWhatsNewTab, settingsFsTab} from './settings'
export {settingsChatTab, settingsNotificationsTab, settingsAboutTab, settingsLogOutTab} from './settings'
export {settingsScreenprotectorTab, settingsContactsTab, settingsInvitationsTab} from './settings'
export {settingsCryptoTab, settingsDevicesTab, settingsFeedbackTab, settingsDisplayTab} from './settings'
export {settingsPasswordTab, settingsWalletsTab, settingsGitTab, settingsAdvancedTab} from './settings'
export {_useState as useSettingsState} from './settings'
export {settingsTab, chatTab, cryptoTab, devicesTab, folderTab, loginTab, type Tab} from './tabs'
export {peopleTab, searchTab, teamsTab, gitTab, fsTab, walletsTab, type AppTab} from './tabs'
export {settingsWaitingKey, checkPasswordWaitingKey} from './settings'
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
export {_useState as useTeamsState, teamWaitingKey, getCanPerformByID, getTeamNameFromID} from './teams'
export {_useState as useTrackerState} from './tracker2'
export {_useState as useUFState} from './unlock-folders'
export {_useState as useUsersState} from './users'
export {_useState as useWaitingState, useAnyWaiting, useAnyErrors, useDispatchClearWaiting} from './waiting'
export {_useState as useWalletsState} from './wallets'
export {_useState as useWNState} from './whats-new'
export {getSelectedConversation, _useState as useChatState} from './chat2'
export {_useConvoState as useConvoState, _stores as chatStores, _Provider as ChatProvider} from './chat2'
export {noConversationIDKey, _getConvoState as getConvoState, _useContext as useChatContext} from './chat2'
export {dummyConversationIDKey, pendingWaitingConversationIDKey, pendingErrorConversationIDKey} from './chat2'
export {useChatNavigateAppend, ProviderScreen, useCIDChanged, clearChatStores} from './chat2'
export {_useConfigState as useConfigState, type Store as ConfigStore} from './config'
export {createOtherAccountWaitingKey} from './config'
export {default as shallowEqual} from 'shallowequal'
import {_useState as useFSState} from './fs'
import {_useConfigState as useConfigState} from './config'
export const initListeners = () => {
  useFSState.getState().dispatch.setupSubscriptions()
  useConfigState.getState().dispatch.setupSubscriptions()
}

import {useSelector, shallowEqual} from 'react-redux'
export function useRemoteStore<S>(): S {
  // TODO this will warn you not to do this, could just pass in a selector later
  return useSelector(s => s, shallowEqual) as any
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

export async function neverThrowPromiseFunc<T>(f: () => Promise<T>) {
  try {
    return await f()
  } catch {
    return undefined
  }
}

export const assertNever = (_: never) => undefined

import {useNavigation} from '@react-navigation/core'
import {type RouteKeys} from '../router-v2/route-params'
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

// Get the mounted state of a component
export const useIsMounted = () => {
  const mounted = React.useRef(true)
  React.useEffect(() => {
    return () => {
      mounted.current = false
    }
  }, [])
  const isMounted = React.useCallback(() => mounted.current, [])
  return isMounted
}

// Run a function on mount once
export const useOnMountOnce = (f: () => void) => {
  const onceRef = React.useRef(true)
  if (onceRef.current) {
    onceRef.current = false
    // defer a frame so you don't get react issues
    setTimeout(f, 1)
  }
}

// Run a function on unmount, doesn't rerun if the function changes
export const useOnUnMountOnce = (f: () => void) => {
  const ref = React.useRef(f)
  ref.current = f
  React.useEffect(() => {
    return () => {
      ref.current()
    }
  }, [])
}
