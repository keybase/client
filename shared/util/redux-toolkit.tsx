import {createListenerMiddleware} from '@reduxjs/toolkit'
import type {TypedActions, TypedActionsMap} from '../actions/typed-actions-gen'
import type {TypedState} from '../constants/reducer'
import isArray from 'lodash/isArray'
type ActionTypes = keyof TypedActionsMap

type TypedDispatch = (action: TypedActions) => void
export type ListenerApi = {
  take: (matcher: (a: TypedActions) => boolean, timeoutms?: number) => unknown
  dispatch: TypedDispatch
  getState: () => TypedState
}

export const listenerMiddleware = createListenerMiddleware()

export type ListenActionReturn =
  | void
  | TypedActions
  | null
  | boolean
  | Array<ListenActionReturn>
  | Promise<ListenActionReturn>

// Get the values of an Array. i.e. ValuesOf<["FOO", "BAR"]> => "FOO" | "BAR"
type ValuesOf<T extends any[]> = T[number]
interface ListenAction {
  <AT extends ActionTypes>(
    actions: AT,
    handler: (state: TypedState, action: TypedActionsMap[AT], listenerApi: ListenerApi) => ListenActionReturn
  ): void

  <AT extends ActionTypes[]>(
    actions: AT,
    handler: (
      state: TypedState,
      action: TypedActionsMap[ValuesOf<AT>],
      listenerApi: ListenerApi
    ) => ListenActionReturn
  ): void
}

// bridge to make the toolkit api like our chain api
const listenActionImpl = (
  action: TypedActions | Array<TypedActions>,
  effect: (...args: Array<any>) => any
) => {
  const actions: Array<TypedActions> = isArray(action) ? action : [action]
  const matcher: any = action => actions.includes(action.type)
  listenerMiddleware.startListening({
    effect: async (action, listenerApi) => {
      const toPut = await effect(listenerApi.getState(), action, listenerApi)
      const toPuts = isArray(toPut) ? toPut : [toPut]
      for (const act of toPuts) {
        act && listenerApi.dispatch(act)
      }
    },
    matcher,
  })
}

export const listenAction: ListenAction = listenActionImpl as unknown as any
