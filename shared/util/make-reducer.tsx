import {TypedActionsMap, TypedActions} from '../actions/typed-actions-gen'
import {produce, Draft} from 'immer'

type GetTypes<A> = A extends {type: string} ? A['type'] : never

function makeReducer<A, S>(
  initialState: S,
  map: {
    [type in GetTypes<A>]?: type extends keyof TypedActionsMap
      ? ((state: Draft<S>, action: TypedActionsMap[type]) => void | S)
      : never
  }
) {
  return (state: S = initialState, action: TypedActions): S =>
    // @ts-ignore
    produce(state, (draft: Draft<S>) => {
      const actionReducer = map[action.type]
      return actionReducer ? actionReducer(draft, action) : undefined
    })
}

export default makeReducer
