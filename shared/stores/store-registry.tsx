// used to allow non-circular cross-calls between stores
// ONLY for zustand stores
import type * as T from '@/constants/types'
import type * as ConvoStateType from '@/stores/convostate'
import type {ConvoState} from '@/stores/convostate'
import type {State as ChatState, useChatState} from '@/stores/chat'
import type {State as DaemonState, useDaemonState} from '@/stores/daemon'
import type {State as FSState, useFSState} from '@/stores/fs'
import type {State as PeopleState, usePeopleState} from '@/stores/people'
import type {State as ProvisionState, useProvisionState} from '@/stores/provision'
import type {State as PushState, usePushState} from '@/stores/push'
import type {
  State as RecoverPasswordState,
  useState as useRecoverPasswordState,
} from '@/stores/recover-password'
import type {State as SettingsState, useSettingsState} from '@/stores/settings'
import type {State as SettingsEmailState, useSettingsEmailState} from '@/stores/settings-email'
import type {State as SettingsPhoneState, useSettingsPhoneState} from '@/stores/settings-phone'
import type {State as SignupState, useSignupState} from '@/stores/signup'
import type {State as TeamsState, useTeamsState} from '@/stores/teams'
import type {State as TrackerState, useTrackerState} from '@/stores/tracker'
import type {State as UsersState, useUsersState} from '@/stores/users'

type StoreName =
  | 'chat'
  | 'daemon'
  | 'fs'
  | 'people'
  | 'provision'
  | 'push'
  | 'recover-password'
  | 'settings'
  | 'settings-email'
  | 'settings-phone'
  | 'signup'
  | 'teams'
  | 'tracker'
  | 'users'

type StoreStates = {
  chat: ChatState
  daemon: DaemonState
  fs: FSState
  people: PeopleState
  provision: ProvisionState
  push: PushState
  'recover-password': RecoverPasswordState
  settings: SettingsState
  'settings-email': SettingsEmailState
  'settings-phone': SettingsPhoneState
  signup: SignupState
  teams: TeamsState
  tracker: TrackerState
  users: UsersState
}

type StoreHooks = {
  chat: typeof useChatState
  daemon: typeof useDaemonState
  fs: typeof useFSState
  people: typeof usePeopleState
  provision: typeof useProvisionState
  push: typeof usePushState
  'recover-password': typeof useRecoverPasswordState
  settings: typeof useSettingsState
  'settings-email': typeof useSettingsEmailState
  'settings-phone': typeof useSettingsPhoneState
  signup: typeof useSignupState
  teams: typeof useTeamsState
  tracker: typeof useTrackerState
  users: typeof useUsersState
}

class StoreRegistry {
  getStore<T extends StoreName>(storeName: T): StoreHooks[T] {
    /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return */
    switch (storeName) {
      case 'chat': {
        const {useChatState} = require('@/stores/chat')
        return useChatState
      }
      case 'daemon': {
        const {useDaemonState} = require('@/stores/daemon')
        return useDaemonState
      }
      case 'fs': {
        const {useFSState} = require('@/stores/fs')
        return useFSState
      }
      case 'people': {
        const {usePeopleState} = require('@/stores/people')
        return usePeopleState
      }
      case 'provision': {
        const {useProvisionState} = require('@/stores/provision')
        return useProvisionState
      }
      case 'push': {
        const {usePushState} = require('@/stores/push')
        return usePushState
      }
      case 'recover-password': {
        const {useState} = require('@/stores/recover-password')
        return useState
      }
      case 'settings': {
        const {useSettingsState} = require('@/stores/settings')
        return useSettingsState
      }
      case 'settings-email': {
        const {useSettingsEmailState} = require('@/stores/settings-email')
        return useSettingsEmailState
      }
      case 'settings-phone': {
        const {useSettingsPhoneState} = require('@/stores/settings-phone')
        return useSettingsPhoneState
      }
      case 'signup': {
        const {useSignupState} = require('@/stores/signup')
        return useSignupState
      }
      case 'teams': {
        const {useTeamsState} = require('@/stores/teams')
        return useTeamsState
      }
      case 'tracker': {
        const {useTrackerState} = require('@/stores/tracker')
        return useTrackerState
      }
      case 'users': {
        const {useUsersState} = require('@/stores/users')
        return useUsersState
      }
      default:
        throw new Error(`Unknown store: ${storeName}`)
    }
  }

  getState<T extends StoreName>(storeName: T): StoreStates[T] {
    return this.getStore(storeName).getState() as StoreStates[T]
  }

  getConvoState(id: T.Chat.ConversationIDKey): ConvoState {
    const {getConvoState} = require('@/stores/convostate') as typeof ConvoStateType
    return getConvoState(id)
  }
}

export const storeRegistry = new StoreRegistry()
