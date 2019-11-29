import {TypedActionsMap, TypedActions} from '../actions/typed-actions-gen'
import {produce, Draft} from 'immer'

type GetTypes<A> = A extends {type: string} ? A['type'] : never

// helper for making sub reducer helpers
export type ActionHandler<A, S> = {
  [type in GetTypes<A>]?: type extends keyof TypedActionsMap
    ? (state: Draft<S>, action: TypedActionsMap[type]) => void | S
    : never
}

function makeReducer<A, S>(initialState: S, map: ActionHandler<A, S>) {
  return (state: S = initialState, action: TypedActions): S =>
    // @ts-ignore
    produce(state, (draft: Draft<S>) => {
      // @ts-ignore
      const actionReducer = map[action.type]
      return actionReducer ? actionReducer(draft, action) : undefined
    })
}

export default makeReducer
