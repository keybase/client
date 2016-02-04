/* @flow */

export type TypedAction<T, P, E> = {
  error?: false,
  type: T,
  payload: P
} | {
  error: true,
  type: T,
  payload: E
}

export type Action = TypedAction<string, any, any>
export type GetState = () => Object
export type AsyncAction = (dispatch: Dispatch, getState: GetState) => ?Promise
export type Dispatch = (action: TypedAction | AsyncAction) => ?Promise

export type TypedAsyncAction<T, P, E> = (dispatch: TypedDispatch<T, P, E>, getState: GetState) => ?Promise
export type TypedDispatch<T, P, E> = (action: TypedAction<T, P, E> | AsyncAction<T, P, E>) => ?Promise
