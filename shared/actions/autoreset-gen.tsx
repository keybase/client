// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate

// Constants
export const resetStore = 'common:resetStore' // not a part of autoreset but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'autoreset:'
export const dummy = 'autoreset:dummy'

// Payload Types
type _DummyPayload = void

// Action Creators
/**
 * Remove this when this file gets a real action.
 */
export const createDummy = (payload: _DummyPayload): DummyPayload => ({payload, type: dummy})

// Action Payloads
export type DummyPayload = {readonly payload: _DummyPayload; readonly type: typeof dummy}

// All Actions
// prettier-ignore
export type Actions =
  | DummyPayload
  | {type: 'common:resetStore', payload: {}}
