// used to allow non-circular cross-calls between stores
// ONLY for zustand stores
import type * as ChatType from './chat2'
import type * as ConfigType from './config'
import type * as CurrentUserType from './current-user'
import type * as DaemonType from './daemon'
import type * as TeamsType from './teams'
import type * as UsersType from './users'
import type * as RouterType from './router2'

type StoreName = 'chat' | 'config' | 'current-user' | 'daemon' | 'teams' | 'users' | 'router'

type StoreActions = {
  chat: ChatType.State['dispatch']
  config: ConfigType.State['dispatch']
  'current-user': CurrentUserType.State['dispatch']
  daemon: DaemonType.State['dispatch']
  router: RouterType.State['dispatch']
  teams: TeamsType.State['dispatch']
  users: UsersType.State['dispatch']
}

type StoreStates = {
  chat: ChatType.State
  config: ConfigType.State
  'current-user': CurrentUserType.State
  daemon: DaemonType.State
  router: RouterType.State
  teams: TeamsType.State
  users: UsersType.State
}

type FunctionKeys<T> = {
  [K in keyof T]: T[K] extends (...args: any[]) => any ? K : never
}[keyof T]

type ActionName<T extends StoreName> = FunctionKeys<StoreActions[T]> & string

type ActionFunction<T extends StoreName, A extends ActionName<T>> = StoreActions[T][A] extends (
  ...args: any[]
) => any
  ? StoreActions[T][A]
  : never

class StoreRegistry {
  private getStoreState<T extends StoreName>(storeName: T): StoreStates[T] {
    switch (storeName) {
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
      default:
        throw new Error(`Unknown store: ${storeName}`)
    }
  }

  crosscall<T extends StoreName, A extends ActionName<T>>(
    storeName: T,
    actionName: A,
    ...args: Parameters<ActionFunction<T, A>>
  ): ReturnType<ActionFunction<T, A>> {
    const state = this.getStoreState(storeName)
    // @ts-ignore
    const action = state.dispatch[actionName] as ActionFunction<T, A>
    if (typeof action !== 'function') {
      throw new Error(`Action ${actionName} not found on store ${storeName}`)
    }
    return action(...args) as ReturnType<ActionFunction<T, A>>
  }

  getState<T extends StoreName>(storeName: T): StoreStates[T] {
    return this.getStoreState(storeName)
  }
}

export const storeRegistry = new StoreRegistry()
