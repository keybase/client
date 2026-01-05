// used to allow non-circular cross-calls between stores
// ONLY for zustand stores
import type * as T from './types'
import type * as TBType from './team-building'
import type * as ConvoStateType from './chat2/convostate'
import type {ConvoState} from './chat2/convostate'
import type {State as ActiveState, useActiveState} from './active'
import type {State as ArchiveState, useArchiveState} from './archive'
import type {State as AutoResetState, useAutoResetState} from './autoreset'
import type {State as AvatarState, useAvatarState} from '@/common-adapters/avatar/store'
import type {State as BotsState, useBotsState} from './bots'
import type {State as ChatState, useChatState} from './chat2'
import type {State as ConfigState, useConfigState} from './config'
import type {State as CryptoState, useCryptoState} from './crypto'
import type {State as CurrentUserState, useCurrentUserState} from './current-user'
import type {State as DaemonState, useDaemonState} from './daemon'
import type {State as DarkModeState, useDarkModeState} from './darkmode'
import type {State as DeepLinksState, useDeepLinksState} from './deeplinks'
import type {State as DevicesState, useDevicesState} from './devices'
import type {State as EngineState, useEngineState} from './engine'
import type {State as FollowersState, useFollowerState} from './followers'
import type {State as FSState, useFSState} from './fs'
import type {State as GitState, useGitState} from './git'
import type {State as LogoutState, useLogoutState} from './logout'
import type {State as NotificationsState, useNotifState} from './notifications'
import type {State as PeopleState, usePeopleState} from './people'
import type {State as PinentryState, usePinentryState} from './pinentry'
import type {State as ProfileState, useProfileState} from './profile'
import type {State as ProvisionState, useProvisionState} from './provision'
import type {State as PushState, usePushState} from './push'
import type {State as RecoverPasswordState, useState as useRecoverPasswordState} from './recover-password'
import type {State as RouterState, useRouterState} from './router2'
import type {State as SettingsState, useSettingsState} from './settings'
import type {State as SettingsChatState, useSettingsChatState} from './settings-chat'
import type {State as SettingsContactsState, useSettingsContactsState} from './settings-contacts'
import type {State as SettingsEmailState, useSettingsEmailState} from './settings-email'
import type {State as SettingsPasswordState, usePWState} from './settings-password'
import type {State as SettingsPhoneState, useSettingsPhoneState} from './settings-phone'
import type {State as SignupState, useSignupState} from './signup'
import type {State as TeamsState, useTeamsState} from './teams'
import type {State as Tracker2State, useTrackerState} from './tracker2'
import type {State as UnlockFoldersState, useUnlockFoldersState} from './unlock-folders'
import type {State as UsersState, useUsersState} from './users'
import type {State as WaitingState, useWaitingState} from './waiting'
import type {State as WhatsNewState, useWhatsNewState} from './whats-new'

type StoreName =
  | 'active'
  | 'archive'
  | 'autoreset'
  | 'avatar'
  | 'bots'
  | 'chat'
  | 'config'
  | 'crypto'
  | 'current-user'
  | 'daemon'
  | 'dark-mode'
  | 'deeplinks'
  | 'devices'
  | 'engine'
  | 'followers'
  | 'fs'
  | 'git'
  | 'logout'
  | 'notifications'
  | 'people'
  | 'pinentry'
  | 'profile'
  | 'provision'
  | 'push'
  | 'recover-password'
  | 'router'
  | 'settings'
  | 'settings-chat'
  | 'settings-contacts'
  | 'settings-email'
  | 'settings-password'
  | 'settings-phone'
  | 'signup'
  | 'teams'
  | 'tracker2'
  | 'unlock-folders'
  | 'users'
  | 'waiting'
  | 'whats-new'

type StoreStates = {
  active: ActiveState
  archive: ArchiveState
  autoreset: AutoResetState
  avatar: AvatarState
  bots: BotsState
  chat: ChatState
  config: ConfigState
  crypto: CryptoState
  'current-user': CurrentUserState
  daemon: DaemonState
  'dark-mode': DarkModeState
  deeplinks: DeepLinksState
  devices: DevicesState
  engine: EngineState
  followers: FollowersState
  fs: FSState
  git: GitState
  logout: LogoutState
  notifications: NotificationsState
  people: PeopleState
  pinentry: PinentryState
  profile: ProfileState
  provision: ProvisionState
  push: PushState
  'recover-password': RecoverPasswordState
  router: RouterState
  settings: SettingsState
  'settings-chat': SettingsChatState
  'settings-contacts': SettingsContactsState
  'settings-email': SettingsEmailState
  'settings-password': SettingsPasswordState
  'settings-phone': SettingsPhoneState
  signup: SignupState
  teams: TeamsState
  tracker2: Tracker2State
  'unlock-folders': UnlockFoldersState
  users: UsersState
  waiting: WaitingState
  'whats-new': WhatsNewState
}

type StoreHooks = {
  active: typeof useActiveState
  archive: typeof useArchiveState
  autoreset: typeof useAutoResetState
  avatar: typeof useAvatarState
  bots: typeof useBotsState
  chat: typeof useChatState
  config: typeof useConfigState
  crypto: typeof useCryptoState
  'current-user': typeof useCurrentUserState
  daemon: typeof useDaemonState
  'dark-mode': typeof useDarkModeState
  deeplinks: typeof useDeepLinksState
  devices: typeof useDevicesState
  engine: typeof useEngineState
  followers: typeof useFollowerState
  fs: typeof useFSState
  git: typeof useGitState
  logout: typeof useLogoutState
  notifications: typeof useNotifState
  people: typeof usePeopleState
  pinentry: typeof usePinentryState
  profile: typeof useProfileState
  provision: typeof useProvisionState
  push: typeof usePushState
  'recover-password': typeof useRecoverPasswordState
  router: typeof useRouterState
  settings: typeof useSettingsState
  'settings-chat': typeof useSettingsChatState
  'settings-contacts': typeof useSettingsContactsState
  'settings-email': typeof useSettingsEmailState
  'settings-password': typeof usePWState
  'settings-phone': typeof useSettingsPhoneState
  signup: typeof useSignupState
  teams: typeof useTeamsState
  tracker2: typeof useTrackerState
  'unlock-folders': typeof useUnlockFoldersState
  users: typeof useUsersState
  waiting: typeof useWaitingState
  'whats-new': typeof useWhatsNewState
}

class StoreRegistry {
  async getStore<T extends StoreName>(storeName: T): Promise<StoreHooks[T]> {
    switch (storeName) {
      case 'active': {
        const {useActiveState} = await import('./active')
        return useActiveState as StoreHooks[T]
      }
      case 'archive': {
        const {useArchiveState} = await import('./archive')
        return useArchiveState as StoreHooks[T]
      }
      case 'autoreset': {
        const {useAutoResetState} = await import('./autoreset')
        return useAutoResetState as StoreHooks[T]
      }
      case 'avatar': {
        const {useAvatarState} = await import('@/common-adapters/avatar/store')
        return useAvatarState as StoreHooks[T]
      }
      case 'bots': {
        const {useBotsState} = await import('./bots')
        return useBotsState as StoreHooks[T]
      }
      case 'chat': {
        const {useChatState} = await import('./chat2')
        return useChatState as StoreHooks[T]
      }
      case 'config': {
        const {useConfigState} = await import('./config')
        return useConfigState as StoreHooks[T]
      }
      case 'current-user': {
        const {useCurrentUserState} = await import('./current-user')
        return useCurrentUserState as StoreHooks[T]
      }
      case 'crypto': {
        const {useCryptoState} = await import('./crypto')
        return useCryptoState as StoreHooks[T]
      }
      case 'daemon': {
        const {useDaemonState} = await import('./daemon')
        return useDaemonState as StoreHooks[T]
      }
      case 'dark-mode': {
        const {useDarkModeState} = await import('./darkmode')
        return useDarkModeState as StoreHooks[T]
      }
      case 'deeplinks': {
        const {useDeepLinksState} = await import('./deeplinks')
        return useDeepLinksState as StoreHooks[T]
      }
      case 'devices': {
        const {useDevicesState} = await import('./devices')
        return useDevicesState as StoreHooks[T]
      }
      case 'engine': {
        const {useEngineState} = await import('./engine')
        return useEngineState as StoreHooks[T]
      }
      case 'followers': {
        const {useFollowerState} = await import('./followers')
        return useFollowerState as StoreHooks[T]
      }
      case 'fs': {
        const {useFSState} = await import('./fs')
        return useFSState as StoreHooks[T]
      }
      case 'git': {
        const {useGitState} = await import('./git')
        return useGitState as StoreHooks[T]
      }
      case 'logout': {
        const {useLogoutState} = await import('./logout')
        return useLogoutState as StoreHooks[T]
      }
      case 'notifications': {
        const {useNotifState} = await import('./notifications')
        return useNotifState as StoreHooks[T]
      }
      case 'people': {
        const {usePeopleState} = await import('./people')
        return usePeopleState as StoreHooks[T]
      }
      case 'pinentry': {
        const {usePinentryState} = await import('./pinentry')
        return usePinentryState as StoreHooks[T]
      }
      case 'profile': {
        const {useProfileState} = await import('./profile')
        return useProfileState as StoreHooks[T]
      }
      case 'provision': {
        const {useProvisionState} = await import('./provision')
        return useProvisionState as StoreHooks[T]
      }
      case 'push': {
        const {usePushState} = await import('./push')
        return usePushState as StoreHooks[T]
      }
      case 'recover-password': {
        const {useState} = await import('./recover-password')
        return useState as StoreHooks[T]
      }
      case 'router': {
        const {useRouterState} = await import('./router2')
        return useRouterState as StoreHooks[T]
      }
      case 'settings': {
        const {useSettingsState} = await import('./settings')
        return useSettingsState as StoreHooks[T]
      }
      case 'settings-chat': {
        const {useSettingsChatState} = await import('./settings-chat')
        return useSettingsChatState as StoreHooks[T]
      }
      case 'settings-contacts': {
        const {useSettingsContactsState} = await import('./settings-contacts')
        return useSettingsContactsState as StoreHooks[T]
      }
      case 'settings-email': {
        const {useSettingsEmailState} = await import('./settings-email')
        return useSettingsEmailState as StoreHooks[T]
      }
      case 'settings-password': {
        const {usePWState} = await import('./settings-password')
        return usePWState as StoreHooks[T]
      }
      case 'settings-phone': {
        const {useSettingsPhoneState} = await import('./settings-phone')
        return useSettingsPhoneState as StoreHooks[T]
      }
      case 'signup': {
        const {useSignupState} = await import('./signup')
        return useSignupState as StoreHooks[T]
      }
      case 'teams': {
        const {useTeamsState} = await import('./teams')
        return useTeamsState as StoreHooks[T]
      }
      case 'tracker2': {
        const {useTrackerState} = await import('./tracker2')
        return useTrackerState as StoreHooks[T]
      }
      case 'unlock-folders': {
        const {useUnlockFoldersState} = await import('./unlock-folders')
        return useUnlockFoldersState as StoreHooks[T]
      }
      case 'users': {
        const {useUsersState} = await import('./users')
        return useUsersState as StoreHooks[T]
      }
      case 'waiting': {
        const {useWaitingState} = await import('./waiting')
        return useWaitingState as StoreHooks[T]
      }
      case 'whats-new': {
        const {useWhatsNewState} = await import('./whats-new')
        return useWhatsNewState as StoreHooks[T]
      }
      default:
        throw new Error(`Unknown store: ${storeName}`)
    }
  }

  async getState<T extends StoreName>(storeName: T): Promise<StoreStates[T]> {
    const store = await this.getStore(storeName)
    return store.getState() as StoreStates[T]
  }

  async getTBStore(name: T.TB.AllowedNamespace): Promise<TBType.State> {
    const {createTBStore} = await import('./team-building')
    const store = createTBStore(name)
    return store.getState()
  }

  async getConvoState(id: T.Chat.ConversationIDKey): Promise<ConvoState> {
    const {getConvoState} = await import('./chat2/convostate')
    return getConvoState(id)
  }
}

export const storeRegistry = new StoreRegistry()
