// @flow
// Don't import reducer here as it causes a cyclical dependency
export type LogTransformer = any

export type TypedAction<T, P, E> =
  | {
      error?: false,
      type: T,
      payload: P,
    }
  | {
      error: true,
      type: T,
      payload: E,
    }

export type NoErrorTypedAction<T, P> = TypedAction<T, P, P>

export type Action = TypedAction<any, any, any>
export type GetState = () => any
export type AsyncAction = (dispatch: Dispatch, getState: GetState) => ?Promise<*> // eslint-disable-line no-use-before-define
export type Dispatch = (action: AsyncAction | Action) => ?Promise<*> // eslint-disable-line no-use-before-define

export type TypedAsyncAction = (dispatch: Dispatch, getState: GetState) => ?Promise<*>
