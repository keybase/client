// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate

import type * as Types from '../constants/types/people'

// Constants
export const resetStore = 'common:resetStore' // not a part of people but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'people:'
export const skipTodo = 'people:skipTodo'

// Action Creators
export const createSkipTodo = (payload: {readonly type: Types.TodoType}) => ({
  payload,
  type: skipTodo as typeof skipTodo,
})

// Action Payloads
export type SkipTodoPayload = ReturnType<typeof createSkipTodo>

// All Actions
// prettier-ignore
export type Actions =
  | SkipTodoPayload
  | {readonly type: 'common:resetStore', readonly payload: undefined}
