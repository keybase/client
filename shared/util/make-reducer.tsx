import {TypedActionsMap, TypedActions} from '../actions/typed-actions-gen'
import {produce, Draft} from 'immer'

type GetTypes<A> = A extends {type: string} ? A['type'] : never

// helper for making sub reducer helpers
export type ActionHandler<A, S> = {
  [type in GetTypes<A>]?: type extends keyof TypedActionsMap
    ? (state: Draft<S>, action: TypedActionsMap[type]) => void | S
    : never
}

function makeReducer<A, S>(
  initialState: S,
  map: ActionHandler<A, S> & {
    // you MUST handle this action
    'common:resetStore': (state: Draft<S>, action: TypedActionsMap['common:resetStore']) => void | S
  }
) {
  return (state: S = initialState, action: TypedActions): S => {
    const actionReducer = map[action.type]
    if (!actionReducer) {
      return state
    }
    return produce(state, (draft: Draft<S>) => {
      return actionReducer(draft, action)
    })
  }
}

export default makeReducer
