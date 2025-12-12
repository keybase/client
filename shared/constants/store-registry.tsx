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
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const {useChatState} = require('./chat2') as typeof ChatType
        return useChatState.getState() as StoreStates[T]
      }
      case 'teams': {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
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
    ...args: Parameters<ActionFunction<T, A>>
  ): ReturnType<ActionFunction<T, A>> {
    const state = this.getStoreState(storeName)
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

