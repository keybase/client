// used to allow non-circular cross-calls between stores
// ONLY for zustand stores
import type * as ActiveType from './active'
import type * as ChatType from './chat2'
import type * as ConfigType from './config'
import type * as CurrentUserType from './current-user'
import type * as DaemonType from './daemon'
import type * as DeepLinksType from './deeplinks'
import type * as RouterType from './router2'
import type * as TeamsType from './teams'
import type * as TBType from './team-building'
import type * as UsersType from './users'
import type * as WaitingType from './waiting'
import type * as T from './types'
import type {ConvoState} from './chat2/convostate'

type StoreName = 'active' | 'chat' | 'config' | 'current-user' | 'daemon' | 'deeplinks' | 'router' | 'teams' | 'users' | 'waiting'


type StoreStates = {
  active: ActiveType.State
  chat: ChatType.State
  config: ConfigType.State
  'current-user': CurrentUserType.State
  daemon: DaemonType.State
  deeplinks: DeepLinksType.State
  router: RouterType.State
  teams: TeamsType.State
  users: UsersType.State
  waiting: WaitingType.State
}

class StoreRegistry {
  private getStoreState<T extends StoreName>(storeName: T): StoreStates[T] {
    switch (storeName) {
      case 'active': {
        const {useActiveState} = require('./active') as typeof ActiveType
        return useActiveState.getState() as StoreStates[T]
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
      case 'deeplinks': {
        const {useDeepLinksState} = require('./deeplinks') as typeof DeepLinksType
        return useDeepLinksState.getState() as StoreStates[T]
      }
      case 'router': {
        const {useRouterState} = require('./router2') as typeof RouterType
        return useRouterState.getState() as StoreStates[T]
      }
      case 'teams': {
        const {useTeamsState} = require('./teams') as typeof TeamsType
        return useTeamsState.getState() as StoreStates[T]
      }
      case 'users': {
        const {useUsersState} = require('./users') as typeof UsersType
        return useUsersState.getState() as StoreStates[T]
      }
      case 'waiting': {
        const {useWaitingState} = require('./waiting') as typeof WaitingType
        return useWaitingState.getState() as StoreStates[T]
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
