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
  getStore<T extends StoreName>(storeName: T): StoreHooks[T] {
    /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return */
    switch (storeName) {
      case 'active': {
        const {useActiveState} = require('./active')
        return useActiveState
      }
      case 'archive': {
        const {useArchiveState} = require('./archive')
        return useArchiveState
      }
      case 'autoreset': {
        const {useAutoResetState} = require('./autoreset')
        return useAutoResetState
      }
      case 'avatar': {
        const {useAvatarState} = require('@/common-adapters/avatar/store')
        return useAvatarState
      }
      case 'bots': {
        const {useBotsState} = require('./bots')
        return useBotsState
      }
      case 'chat': {
        const {useChatState} = require('./chat2')
        return useChatState
      }
      case 'config': {
        const {useConfigState} = require('./config')
        return useConfigState
      }
      case 'current-user': {
        const {useCurrentUserState} = require('./current-user')
        return useCurrentUserState
      }
      case 'crypto': {
        const {useCryptoState} = require('./crypto')
        return useCryptoState
      }
      case 'daemon': {
        const {useDaemonState} = require('./daemon')
        return useDaemonState
      }
      case 'dark-mode': {
        const {useDarkModeState} = require('./darkmode')
        return useDarkModeState
      }
      case 'deeplinks': {
        const {useDeepLinksState} = require('./deeplinks')
        return useDeepLinksState
      }
      case 'devices': {
        const {useDevicesState} = require('./devices')
        return useDevicesState
      }
      case 'engine': {
        const {useEngineState} = require('./engine')
        return useEngineState
      }
      case 'followers': {
        const {useFollowerState} = require('./followers')
        return useFollowerState
      }
      case 'fs': {
        const {useFSState} = require('./fs')
        return useFSState
      }
      case 'git': {
        const {useGitState} = require('./git')
        return useGitState
      }
      case 'logout': {
        const {useLogoutState} = require('./logout')
        return useLogoutState
      }
      case 'notifications': {
        const {useNotifState} = require('./notifications')
        return useNotifState
      }
      case 'people': {
        const {usePeopleState} = require('./people')
        return usePeopleState
      }
      case 'pinentry': {
        const {usePinentryState} = require('./pinentry')
        return usePinentryState
      }
      case 'profile': {
        const {useProfileState} = require('./profile')
        return useProfileState
      }
      case 'provision': {
        const {useProvisionState} = require('./provision')
        return useProvisionState
      }
      case 'push': {
        const {usePushState} = require('./push')
        return usePushState
      }
      case 'recover-password': {
        const {useState} = require('./recover-password')
        return useState
      }
      case 'router': {
        const {useRouterState} = require('./router2')
        return useRouterState
      }
      case 'settings': {
        const {useSettingsState} = require('./settings')
        return useSettingsState
      }
      case 'settings-chat': {
        const {useSettingsChatState} = require('./settings-chat')
        return useSettingsChatState
      }
      case 'settings-contacts': {
        const {useSettingsContactsState} = require('./settings-contacts')
        return useSettingsContactsState
      }
      case 'settings-email': {
        const {useSettingsEmailState} = require('./settings-email')
        return useSettingsEmailState
      }
      case 'settings-password': {
        const {usePWState} = require('./settings-password')
        return usePWState
      }
      case 'settings-phone': {
        const {useSettingsPhoneState} = require('./settings-phone')
        return useSettingsPhoneState
      }
      case 'signup': {
        const {useSignupState} = require('./signup')
        return useSignupState
      }
      case 'teams': {
        const {useTeamsState} = require('./teams')
        return useTeamsState
      }
      case 'tracker2': {
        const {useTrackerState} = require('./tracker2')
        return useTrackerState
      }
      case 'unlock-folders': {
        const {useUnlockFoldersState} = require('./unlock-folders')
        return useUnlockFoldersState
      }
      case 'users': {
        const {useUsersState} = require('./users')
        return useUsersState
      }
      case 'waiting': {
        const {useWaitingState} = require('./waiting')
        return useWaitingState
      }
      case 'whats-new': {
        const {useWhatsNewState} = require('./whats-new')
        return useWhatsNewState
      }
      default:
        throw new Error(`Unknown store: ${storeName}`)
    }
  }

  getState<T extends StoreName>(storeName: T): StoreStates[T] {
    return this.getStore(storeName).getState() as StoreStates[T]
  }

  getTBStore(name: T.TB.AllowedNamespace): TBType.State {
    const {createTBStore} = require('./team-building') as typeof TBType
    const store = createTBStore(name)
    return store.getState()
  }

  getConvoState(id: T.Chat.ConversationIDKey): ConvoState {
    const {getConvoState} = require('./chat2/convostate') as typeof ConvoStateType
    return getConvoState(id)
  }
}

export const storeRegistry = new StoreRegistry()

if (module.hot) {
  module.hot.accept()
}
