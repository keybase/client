// @flow
/* eslint-disable */
// Don't import reducer here as it causes a cyclical dependency
export type LogTransformer = any

export type TypedAction<T, P, E> = any

export type NoErrorTypedAction<T, P> = TypedAction<T, P, P>

export type Action = any
export type GetState = any
export type AsyncAction = any
export type Dispatch = any

export type TypedAsyncAction = any
