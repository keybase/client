import type * as ChatType from './chat2'
import type * as TeamsType from './teams'

type StoreName = 'chat' | 'teams'

type StoreActions = {
  chat: ChatType.State['dispatch']
  teams: TeamsType.State['dispatch']
}

type StoreStates = {
  chat: ChatType.State
  teams: TeamsType.State
}

type ActionName<T extends StoreName> = keyof StoreActions[T] & string

class StoreRegistry {
  private getStoreState<T extends StoreName>(storeName: T): StoreStates[T] {
    switch (storeName) {
      case 'chat': {
        const {useChatState} = require('./chat2') as typeof ChatType
        return useChatState.getState() as StoreStates[T]
      }
      case 'teams': {
        const {useTeamsState} = require('./teams') as typeof TeamsType
        return useTeamsState.getState() as StoreStates[T]
      }
      default:
        throw new Error(`Unknown store: ${storeName}`)
    }
  }

  call<T extends StoreName, A extends ActionName<T>>(
    storeName: T,
    actionName: A,
    ...args: Parameters<StoreActions[T][A]>
  ): ReturnType<StoreActions[T][A]> {
    const state = this.getStoreState(storeName)
    const action = state.dispatch[actionName]
    if (typeof action !== 'function') {
      throw new Error(`Action ${actionName} not found on store ${storeName}`)
    }
    return (action as (...args: any[]) => any)(...args)
  }

  getState<T extends StoreName>(storeName: T): StoreStates[T] {
    return this.getStoreState(storeName)
  }
}

export const storeRegistry = new StoreRegistry()

