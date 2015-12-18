/* @flow */

// This should really be a disjoint union, but union of unions doesn't quite work yet:
// and we need that to make a Actions union over different types of actions
// https://github.com/facebook/flow/issues/582
export type TypedAction<T, P, E> = {
  type: T,
  payload?: P,
  error?: boolean
}

export type Action = TypedAction<string, any, any>

export type Dispatch = (action: TypedAction) => void
