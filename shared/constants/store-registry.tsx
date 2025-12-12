// used to allow non-circular cross-calls between stores
// ONLY for zustand stores
import type * as ArchiveType from './archive'
import type * as ActiveType from './active'
import type * as AutoResetType from './autoreset'
import type * as AvatarType from '@/common-adapters/avatar/store'
import type * as BotsType from './bots'
import type * as ChatType from './chat2'
import type * as ConfigType from './config'
import type * as CurrentUserType from './current-user'
import type * as DaemonType from './daemon'
import type * as DarkModeType from './darkmode'
import type * as DeepLinksType from './deeplinks'
import type * as DevicesType from './devices'
import type * as EngineType from './engine'
import type * as FollowersType from './followers'
import type * as FSType from './fs'
import type * as GitType from './git'
import type * as NotificationsType from './notifications'
import type * as PeopleType from './people'
import type * as PinentryType from './pinentry'
import type * as ProfileType from './profile'
import type * as ProvisionType from './provision'
import type * as RouterType from './router2'
import type * as SettingsContactsType from './settings-contacts'
import type * as SettingsEmailType from './settings-email'
import type * as SettingsPasswordType from './settings-password'
import type * as SettingsPhoneType from './settings-phone'
import type * as SettingsType from './settings'
import type * as SignupType from './signup'
import type * as TeamsType from './teams'
import type * as TBType from './team-building'
import type * as Tracker2Type from './tracker2'
import type * as UnlockFoldersType from './unlock-folders'
import type * as UsersType from './users'
import type * as WaitingType from './waiting'
import type * as WhatsNewType from './whats-new'
import type * as T from './types'
import type {ConvoState} from './chat2/convostate'

type StoreName =
  | 'active'
  | 'archive'
  | 'autoreset'
  | 'avatar'
  | 'bots'
  | 'chat'
  | 'config'
  | 'current-user'
  | 'daemon'
  | 'dark-mode'
  | 'deeplinks'
  | 'devices'
  | 'engine'
  | 'followers'
  | 'fs'
  | 'git'
  | 'notifications'
  | 'people'
  | 'pinentry'
  | 'profile'
  | 'provision'
  | 'router'
  | 'settings'
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
  active: ActiveType.State
  archive: ArchiveType.State
  autoreset: AutoResetType.State
  avatar: AvatarType.State
  bots: BotsType.State
  chat: ChatType.State
  config: ConfigType.State
  'current-user': CurrentUserType.State
  daemon: DaemonType.State
  'dark-mode': DarkModeType.State
  deeplinks: DeepLinksType.State
  devices: DevicesType.State
  engine: EngineType.State
  followers: FollowersType.State
  fs: FSType.State
  git: GitType.State
  notifications: NotificationsType.State
  people: PeopleType.State
  pinentry: PinentryType.State
  profile: ProfileType.State
  provision: ProvisionType.State
  router: RouterType.State
  settings: SettingsType.State
  'settings-contacts': SettingsContactsType.State
  'settings-email': SettingsEmailType.State
  'settings-password': SettingsPasswordType.State
  'settings-phone': SettingsPhoneType.State
  signup: SignupType.State
  teams: TeamsType.State
  tracker2: Tracker2Type.State
  'unlock-folders': UnlockFoldersType.State
  users: UsersType.State
  waiting: WaitingType.State
  'whats-new': WhatsNewType.State
}

class StoreRegistry {
  private getStoreState<T extends StoreName>(storeName: T): StoreStates[T] {
    switch (storeName) {
      case 'active': {
        const {useActiveState} = require('./active') as typeof ActiveType
        return useActiveState.getState() as StoreStates[T]
      }
      case 'archive': {
        const {useState} = require('./archive') as typeof ArchiveType
        return useState.getState() as StoreStates[T]
      }
      case 'autoreset': {
        const {useState} = require('./autoreset') as typeof AutoResetType
        return useState.getState() as StoreStates[T]
      }
      case 'avatar': {
        const {useAvatarState} = require('@/common-adapters/avatar/store') as typeof AvatarType
        return useAvatarState.getState() as StoreStates[T]
      }
      case 'bots': {
        const {useBotsState} = require('./bots') as typeof BotsType
        return useBotsState.getState() as StoreStates[T]
      }
      case 'chat': {
        const {useChatState} = require('./chat2') as typeof ChatType
        return useChatState.getState() as StoreStates[T]
      }
      case 'config': {
        const {useConfigState} = require('./config') as typeof ConfigType
        return useConfigState.getState() as StoreStates[T]
      }
      case 'current-user': {
        const {useCurrentUserState} = require('./current-user') as typeof CurrentUserType
        return useCurrentUserState.getState() as StoreStates[T]
      }
      case 'daemon': {
        const {useDaemonState} = require('./daemon') as typeof DaemonType
        return useDaemonState.getState() as StoreStates[T]
      }
      case 'dark-mode': {
        const {useDarkModeState} = require('./darkmode') as typeof DarkModeType
        return useDarkModeState.getState() as StoreStates[T]
      }
      case 'deeplinks': {
        const {useDeepLinksState} = require('./deeplinks') as typeof DeepLinksType
        return useDeepLinksState.getState() as StoreStates[T]
      }
      case 'devices': {
        const {useState} = require('./devices') as typeof DevicesType
        return useState.getState() as StoreStates[T]
      }
      case 'engine': {
        const {useEngineState} = require('./engine') as typeof EngineType
        return useEngineState.getState() as StoreStates[T]
      }
      case 'followers': {
        const {useFollowerState} = require('./followers') as typeof FollowersType
        return useFollowerState.getState() as StoreStates[T]
      }
      case 'fs': {
        const {useFSState} = require('./fs') as typeof FSType
        return useFSState.getState() as StoreStates[T]
      }
      case 'git': {
        const {useGitState} = require('./git') as typeof GitType
        return useGitState.getState() as StoreStates[T]
      }
      case 'notifications': {
        const {useNotifState} = require('./notifications') as typeof NotificationsType
        return useNotifState.getState() as StoreStates[T]
      }
      case 'people': {
        const {usePeopleState} = require('./people') as typeof PeopleType
        return usePeopleState.getState() as StoreStates[T]
      }
      case 'pinentry': {
        const {usePinentryState} = require('./pinentry') as typeof PinentryType
        return usePinentryState.getState() as StoreStates[T]
      }
      case 'profile': {
        const {useProfileState} = require('./profile') as typeof ProfileType
        return useProfileState.getState() as StoreStates[T]
      }
      case 'provision': {
        const {useProvisionState} = require('./provision') as typeof ProvisionType
        return useProvisionState.getState() as StoreStates[T]
      }
      case 'router': {
        const {useRouterState} = require('./router2') as typeof RouterType
        return useRouterState.getState() as StoreStates[T]
      }
      case 'settings': {
        const {useSettingsState} = require('./settings') as typeof SettingsType
        return useSettingsState.getState() as StoreStates[T]
      }
      case 'settings-contacts': {
        const {useSettingsContactsState} = require('./settings-contacts') as typeof SettingsContactsType
        return useSettingsContactsState.getState() as StoreStates[T]
      }
      case 'settings-email': {
        const {useSettingsEmailState} = require('./settings-email') as typeof SettingsEmailType
        return useSettingsEmailState.getState() as StoreStates[T]
      }
      case 'settings-password': {
        const {usePWState} = require('./settings-password') as typeof SettingsPasswordType
        return usePWState.getState() as StoreStates[T]
      }
      case 'settings-phone': {
        const {useSettingsPhoneState} = require('./settings-phone') as typeof SettingsPhoneType
        return useSettingsPhoneState.getState() as StoreStates[T]
      }
      case 'signup': {
        const {useSignupState} = require('./signup') as typeof SignupType
        return useSignupState.getState() as StoreStates[T]
      }
      case 'teams': {
        const {useTeamsState} = require('./teams') as typeof TeamsType
        return useTeamsState.getState() as StoreStates[T]
      }
      case 'tracker2': {
        const {useTrackerState} = require('./tracker2') as typeof Tracker2Type
        return useTrackerState.getState() as StoreStates[T]
      }
      case 'unlock-folders': {
        const {useState} = require('./unlock-folders') as typeof UnlockFoldersType
        return useState.getState() as StoreStates[T]
      }
      case 'users': {
        const {useUsersState} = require('./users') as typeof UsersType
        return useUsersState.getState() as StoreStates[T]
      }
      case 'waiting': {
        const {useWaitingState} = require('./waiting') as typeof WaitingType
        return useWaitingState.getState() as StoreStates[T]
      }
      case 'whats-new': {
        const {useState} = require('./whats-new') as typeof WhatsNewType
        return useState.getState() as StoreStates[T]
      }
      default:
        throw new Error(`Unknown store: ${storeName}`)
    }
  }

  getState<T extends StoreName>(storeName: T): StoreStates[T] {
    return this.getStoreState(storeName)
  }

  getTBStore(name: T.TB.AllowedNamespace): TBType.State {
    const {createTBStore} = require('./team-building') as typeof TBType
    const store = createTBStore(name)
    return store.getState()
  }

  getConvoState(id: T.Chat.ConversationIDKey): ConvoState {
    const {getConvoState} = require('./chat2/convostate')
    return getConvoState(id)
  }
}

export const storeRegistry = new StoreRegistry()
