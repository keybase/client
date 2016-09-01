/* @flow */

export type TypedAction<T, P, E> = {
  error?: false,
  type: T,
  payload: P,
} | {
  error: true,
  type: T,
  payload: E,
}

export type NoErrorTypedAction<T, P> = TypedAction<T, P, P>

export type Action = TypedAction<any, any, any>
export type GetState = () => Object
export type AsyncAction = (dispatch: Dispatch, getState: GetState) => ?Promise<*>
export type Dispatch = (action: AsyncAction | Action) => ?Promise<*>

export type TypedAsyncAction<A> = (dispatch: TypedDispatch<A>, getState: GetState) => ?Promise<*>
export type TypedDispatch<A> = (action: TypedAsyncAction<A> | A) => ?Promise<*>
