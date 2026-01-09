// used to allow non-circular cross-calls between stores
// ONLY for zustand stores
import type * as T from './types'
import type * as TBType from '@/constants/team-building'
import type * as ConvoStateType from '@/constants/chat2/convostate'
import type {ConvoState} from '@/constants/chat2/convostate'
import type {State as AutoResetState, useAutoResetState} from '@/stores/autoreset'
import type {State as BotsState, useBotsState} from '@/stores/bots'
import type {State as ChatState, useChatState} from '@/constants/chat2'
import type {State as DaemonState, useDaemonState} from '@/constants/daemon'
import type {State as DevicesState, useDevicesState} from '@/stores/devices'
import type {State as FSState, useFSState} from '@/constants/fs'
import type {State as GitState, useGitState} from '@/constants/git'
import type {State as NotificationsState, useNotifState} from '@/constants/notifications'
import type {State as PeopleState, usePeopleState} from '@/constants/people'
import type {State as ProfileState, useProfileState} from '@/constants/profile'
import type {State as ProvisionState, useProvisionState} from '@/constants/provision'
import type {State as PushState, usePushState} from '@/constants/push'
import type {
  State as RecoverPasswordState,
  useState as useRecoverPasswordState,
} from '@/constants/recover-password'
import type {State as SettingsState, useSettingsState} from '@/constants/settings'
import type {State as SettingsChatState, useSettingsChatState} from '@/constants/settings-chat'
import type {State as SettingsContactsState, useSettingsContactsState} from '@/constants/settings-contacts'
import type {State as SettingsEmailState, useSettingsEmailState} from '@/constants/settings-email'
import type {State as SettingsPasswordState, usePWState} from '@/constants/settings-password'
import type {State as SettingsPhoneState, useSettingsPhoneState} from '@/constants/settings-phone'
import type {State as SignupState, useSignupState} from '@/constants/signup'
import type {State as TeamsState, useTeamsState} from '@/constants/teams'
import type {State as Tracker2State, useTrackerState} from '@/constants/tracker2'
import type {State as UnlockFoldersState, useUnlockFoldersState} from '@/constants/unlock-folders'
import type {State as UsersState, useUsersState} from '@/constants/users'

type StoreName =
  | 'autoreset'
  | 'bots'
  | 'chat'
  | 'daemon'
  | 'devices'
  | 'fs'
  | 'git'
  | 'notifications'
  | 'people'
  | 'profile'
  | 'provision'
  | 'push'
  | 'recover-password'
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

type StoreStates = {
  autoreset: AutoResetState
  bots: BotsState
  chat: ChatState
  daemon: DaemonState
  devices: DevicesState
  fs: FSState
  git: GitState
  notifications: NotificationsState
  people: PeopleState
  profile: ProfileState
  provision: ProvisionState
  push: PushState
  'recover-password': RecoverPasswordState
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
}

type StoreHooks = {
  autoreset: typeof useAutoResetState
  bots: typeof useBotsState
  chat: typeof useChatState
  daemon: typeof useDaemonState
  devices: typeof useDevicesState
  fs: typeof useFSState
  git: typeof useGitState
  notifications: typeof useNotifState
  people: typeof usePeopleState
  profile: typeof useProfileState
  provision: typeof useProvisionState
  push: typeof usePushState
  'recover-password': typeof useRecoverPasswordState
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
}

class StoreRegistry {
  getStore<T extends StoreName>(storeName: T): StoreHooks[T] {
    /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return */
    switch (storeName) {
      case 'autoreset': {
        const {useAutoResetState} = require('../stores/autoreset')
        return useAutoResetState
      }
      case 'bots': {
        const {useBotsState} = require('../stores/bots')
        return useBotsState
      }
      case 'chat': {
        const {useChatState} = require('./chat2')
        return useChatState
      }
      case 'daemon': {
        const {useDaemonState} = require('./daemon')
        return useDaemonState
      }
      case 'devices': {
        const {useDevicesState} = require('../stores/devices')
        return useDevicesState
      }
      case 'fs': {
        const {useFSState} = require('./fs')
        return useFSState
      }
      case 'git': {
        const {useGitState} = require('./git')
        return useGitState
      }
      case 'notifications': {
        const {useNotifState} = require('./notifications')
        return useNotifState
      }
      case 'people': {
        const {usePeopleState} = require('./people')
        return usePeopleState
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
