// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate

// Constants
export const resetStore = 'common:resetStore' // not a part of pinentry but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'pinentry:'
export const onCancel = 'pinentry:onCancel'
export const onSubmit = 'pinentry:onSubmit'

// Action Creators
export const createOnCancel = (payload?: undefined) => ({payload, type: onCancel as typeof onCancel})
export const createOnSubmit = (payload: {readonly password: string}) => ({
  payload,
  type: onSubmit as typeof onSubmit,
})

// Action Payloads
export type OnCancelPayload = ReturnType<typeof createOnCancel>
export type OnSubmitPayload = ReturnType<typeof createOnSubmit>

// All Actions
// prettier-ignore
export type Actions =
  | OnCancelPayload
  | OnSubmitPayload
  | {readonly type: 'common:resetStore', readonly payload: undefined}
