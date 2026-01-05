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

// Cache required modules to avoid HMR disposal issues
const storeModuleCache = new Map<string, unknown>()

class StoreRegistry {
  getStore<T extends StoreName>(storeName: T): StoreHooks[T] {
    /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return */
    switch (storeName) {
      case 'active': {
        if (!storeModuleCache.has('./active')) {
          storeModuleCache.set('./active', require('./active'))
        }
        const {useActiveState} = storeModuleCache.get('./active') as {useActiveState: StoreHooks['active']}
        return useActiveState
      }
      case 'archive': {
        if (!storeModuleCache.has('./archive')) {
          storeModuleCache.set('./archive', require('./archive'))
        }
        const {useArchiveState} = storeModuleCache.get('./archive') as {useArchiveState: StoreHooks['archive']}
        return useArchiveState
      }
      case 'autoreset': {
        if (!storeModuleCache.has('./autoreset')) {
          storeModuleCache.set('./autoreset', require('./autoreset'))
        }
        const {useAutoResetState} = storeModuleCache.get('./autoreset') as {useAutoResetState: StoreHooks['autoreset']}
        return useAutoResetState
      }
      case 'avatar': {
        if (!storeModuleCache.has('@/common-adapters/avatar/store')) {
          storeModuleCache.set('@/common-adapters/avatar/store', require('@/common-adapters/avatar/store'))
        }
        const {useAvatarState} = storeModuleCache.get('@/common-adapters/avatar/store') as {useAvatarState: StoreHooks['avatar']}
        return useAvatarState
      }
      case 'bots': {
        if (!storeModuleCache.has('./bots')) {
          storeModuleCache.set('./bots', require('./bots'))
        }
        const {useBotsState} = storeModuleCache.get('./bots') as {useBotsState: StoreHooks['bots']}
        return useBotsState
      }
      case 'chat': {
        if (!storeModuleCache.has('./chat2')) {
          storeModuleCache.set('./chat2', require('./chat2'))
        }
        const {useChatState} = storeModuleCache.get('./chat2') as {useChatState: StoreHooks['chat']}
        return useChatState
      }
      case 'config': {
        if (!storeModuleCache.has('./config')) {
          storeModuleCache.set('./config', require('./config'))
        }
        const {useConfigState} = storeModuleCache.get('./config') as {useConfigState: StoreHooks['config']}
        return useConfigState
      }
      case 'current-user': {
        if (!storeModuleCache.has('./current-user')) {
          storeModuleCache.set('./current-user', require('./current-user'))
        }
        const {useCurrentUserState} = storeModuleCache.get('./current-user') as {useCurrentUserState: StoreHooks['current-user']}
        return useCurrentUserState
      }
      case 'crypto': {
        if (!storeModuleCache.has('./crypto')) {
          storeModuleCache.set('./crypto', require('./crypto'))
        }
        const {useCryptoState} = storeModuleCache.get('./crypto') as {useCryptoState: StoreHooks['crypto']}
        return useCryptoState
      }
      case 'daemon': {
        if (!storeModuleCache.has('./daemon')) {
          storeModuleCache.set('./daemon', require('./daemon'))
        }
        const {useDaemonState} = storeModuleCache.get('./daemon') as {useDaemonState: StoreHooks['daemon']}
        return useDaemonState
      }
      case 'dark-mode': {
        if (!storeModuleCache.has('./darkmode')) {
          storeModuleCache.set('./darkmode', require('./darkmode'))
        }
        const {useDarkModeState} = storeModuleCache.get('./darkmode') as {useDarkModeState: StoreHooks['dark-mode']}
        return useDarkModeState
      }
      case 'deeplinks': {
        if (!storeModuleCache.has('./deeplinks')) {
          storeModuleCache.set('./deeplinks', require('./deeplinks'))
        }
        const {useDeepLinksState} = storeModuleCache.get('./deeplinks') as {useDeepLinksState: StoreHooks['deeplinks']}
        return useDeepLinksState
      }
      case 'devices': {
        if (!storeModuleCache.has('./devices')) {
          storeModuleCache.set('./devices', require('./devices'))
        }
        const {useDevicesState} = storeModuleCache.get('./devices') as {useDevicesState: StoreHooks['devices']}
        return useDevicesState
      }
      case 'engine': {
        if (!storeModuleCache.has('./engine')) {
          storeModuleCache.set('./engine', require('./engine'))
        }
        const {useEngineState} = storeModuleCache.get('./engine') as {useEngineState: StoreHooks['engine']}
        return useEngineState
      }
      case 'followers': {
        if (!storeModuleCache.has('./followers')) {
          storeModuleCache.set('./followers', require('./followers'))
        }
        const {useFollowerState} = storeModuleCache.get('./followers') as {useFollowerState: StoreHooks['followers']}
        return useFollowerState
      }
      case 'fs': {
        if (!storeModuleCache.has('./fs')) {
          storeModuleCache.set('./fs', require('./fs'))
        }
        const {useFSState} = storeModuleCache.get('./fs') as {useFSState: StoreHooks['fs']}
        return useFSState
      }
      case 'git': {
        if (!storeModuleCache.has('./git')) {
          storeModuleCache.set('./git', require('./git'))
        }
        const {useGitState} = storeModuleCache.get('./git') as {useGitState: StoreHooks['git']}
        return useGitState
      }
      case 'logout': {
        if (!storeModuleCache.has('./logout')) {
          storeModuleCache.set('./logout', require('./logout'))
        }
        const {useLogoutState} = storeModuleCache.get('./logout') as {useLogoutState: StoreHooks['logout']}
        return useLogoutState
      }
      case 'notifications': {
        if (!storeModuleCache.has('./notifications')) {
          storeModuleCache.set('./notifications', require('./notifications'))
        }
        const {useNotifState} = storeModuleCache.get('./notifications') as {useNotifState: StoreHooks['notifications']}
        return useNotifState
      }
      case 'people': {
        if (!storeModuleCache.has('./people')) {
          storeModuleCache.set('./people', require('./people'))
        }
        const {usePeopleState} = storeModuleCache.get('./people') as {usePeopleState: StoreHooks['people']}
        return usePeopleState
      }
      case 'pinentry': {
        if (!storeModuleCache.has('./pinentry')) {
          storeModuleCache.set('./pinentry', require('./pinentry'))
        }
        const {usePinentryState} = storeModuleCache.get('./pinentry') as {usePinentryState: StoreHooks['pinentry']}
        return usePinentryState
      }
      case 'profile': {
        if (!storeModuleCache.has('./profile')) {
          storeModuleCache.set('./profile', require('./profile'))
        }
        const {useProfileState} = storeModuleCache.get('./profile') as {useProfileState: StoreHooks['profile']}
        return useProfileState
      }
      case 'provision': {
        if (!storeModuleCache.has('./provision')) {
          storeModuleCache.set('./provision', require('./provision'))
        }
        const {useProvisionState} = storeModuleCache.get('./provision') as {useProvisionState: StoreHooks['provision']}
        return useProvisionState
      }
      case 'push': {
        if (!storeModuleCache.has('./push')) {
          storeModuleCache.set('./push', require('./push'))
        }
        const {usePushState} = storeModuleCache.get('./push') as {usePushState: StoreHooks['push']}
        return usePushState
      }
      case 'recover-password': {
        if (!storeModuleCache.has('./recover-password')) {
          storeModuleCache.set('./recover-password', require('./recover-password'))
        }
        const {useState} = storeModuleCache.get('./recover-password') as {useState: StoreHooks['recover-password']}
        return useState
      }
      case 'router': {
        if (!storeModuleCache.has('./router2')) {
          storeModuleCache.set('./router2', require('./router2'))
        }
        const {useRouterState} = storeModuleCache.get('./router2') as {useRouterState: StoreHooks['router']}
        return useRouterState
      }
      case 'settings': {
        if (!storeModuleCache.has('./settings')) {
          storeModuleCache.set('./settings', require('./settings'))
        }
        const {useSettingsState} = storeModuleCache.get('./settings') as {useSettingsState: StoreHooks['settings']}
        return useSettingsState
      }
      case 'settings-chat': {
        if (!storeModuleCache.has('./settings-chat')) {
          storeModuleCache.set('./settings-chat', require('./settings-chat'))
        }
        const {useSettingsChatState} = storeModuleCache.get('./settings-chat') as {useSettingsChatState: StoreHooks['settings-chat']}
        return useSettingsChatState
      }
      case 'settings-contacts': {
        if (!storeModuleCache.has('./settings-contacts')) {
          storeModuleCache.set('./settings-contacts', require('./settings-contacts'))
        }
        const {useSettingsContactsState} = storeModuleCache.get('./settings-contacts') as {useSettingsContactsState: StoreHooks['settings-contacts']}
        return useSettingsContactsState
      }
      case 'settings-email': {
        if (!storeModuleCache.has('./settings-email')) {
          storeModuleCache.set('./settings-email', require('./settings-email'))
        }
        const {useSettingsEmailState} = storeModuleCache.get('./settings-email') as {useSettingsEmailState: StoreHooks['settings-email']}
        return useSettingsEmailState
      }
      case 'settings-password': {
        if (!storeModuleCache.has('./settings-password')) {
          storeModuleCache.set('./settings-password', require('./settings-password'))
        }
        const {usePWState} = storeModuleCache.get('./settings-password') as {usePWState: StoreHooks['settings-password']}
        return usePWState
      }
      case 'settings-phone': {
        if (!storeModuleCache.has('./settings-phone')) {
          storeModuleCache.set('./settings-phone', require('./settings-phone'))
        }
        const {useSettingsPhoneState} = storeModuleCache.get('./settings-phone') as {useSettingsPhoneState: StoreHooks['settings-phone']}
        return useSettingsPhoneState
      }
      case 'signup': {
        if (!storeModuleCache.has('./signup')) {
          storeModuleCache.set('./signup', require('./signup'))
        }
        const {useSignupState} = storeModuleCache.get('./signup') as {useSignupState: StoreHooks['signup']}
        return useSignupState
      }
      case 'teams': {
        if (!storeModuleCache.has('./teams')) {
          storeModuleCache.set('./teams', require('./teams'))
        }
        const {useTeamsState} = storeModuleCache.get('./teams') as {useTeamsState: StoreHooks['teams']}
        return useTeamsState
      }
      case 'tracker2': {
        if (!storeModuleCache.has('./tracker2')) {
          storeModuleCache.set('./tracker2', require('./tracker2'))
        }
        const {useTrackerState} = storeModuleCache.get('./tracker2') as {useTrackerState: StoreHooks['tracker2']}
        return useTrackerState
      }
      case 'unlock-folders': {
        if (!storeModuleCache.has('./unlock-folders')) {
          storeModuleCache.set('./unlock-folders', require('./unlock-folders'))
        }
        const {useUnlockFoldersState} = storeModuleCache.get('./unlock-folders') as {useUnlockFoldersState: StoreHooks['unlock-folders']}
        return useUnlockFoldersState
      }
      case 'users': {
        if (!storeModuleCache.has('./users')) {
          storeModuleCache.set('./users', require('./users'))
        }
        const {useUsersState} = storeModuleCache.get('./users') as {useUsersState: StoreHooks['users']}
        return useUsersState
      }
      case 'waiting': {
        if (!storeModuleCache.has('./waiting')) {
          storeModuleCache.set('./waiting', require('./waiting'))
        }
        const {useWaitingState} = storeModuleCache.get('./waiting') as {useWaitingState: StoreHooks['waiting']}
        return useWaitingState
      }
      case 'whats-new': {
        if (!storeModuleCache.has('./whats-new')) {
          storeModuleCache.set('./whats-new', require('./whats-new'))
        }
        const {useWhatsNewState} = storeModuleCache.get('./whats-new') as {useWhatsNewState: StoreHooks['whats-new']}
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
    if (!storeModuleCache.has('./team-building')) {
      storeModuleCache.set('./team-building', require('./team-building'))
    }
    const {createTBStore} = storeModuleCache.get('./team-building') as typeof TBType
    const store = createTBStore(name)
    return store.getState()
  }

  getConvoState(id: T.Chat.ConversationIDKey): ConvoState {
    if (!storeModuleCache.has('./chat2/convostate')) {
      storeModuleCache.set('./chat2/convostate', require('./chat2/convostate'))
    }
    const {getConvoState} = storeModuleCache.get('./chat2/convostate') as typeof ConvoStateType
    return getConvoState(id)
  }
}

export const storeRegistry = new StoreRegistry()
