// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/flow-types'
import * as More from '../constants/types/more'
import * as Constants from '../constants/pinentry'

// Constants
export const resetStore = 'common:resetStore' // not a part of pinentry but is handled by every reducer
export const newPinentry = 'pinentry:newPinentry'
export const onCancel = 'pinentry:onCancel'
export const onSubmit = 'pinentry:onSubmit'
export const registerPinentryListener = 'pinentry:registerPinentryListener'

// Action Creators
export const createNewPinentry = (payload: {|+features: RPCTypes.GUIEntryFeatures, +type: RPCTypes.PassphraseType, +sessionID: number, +prompt: string, +windowTitle: string, +submitLabel: ?string, +cancelLabel: ?string, +retryLabel: ?string|}) => ({error: false, payload, type: newPinentry})
export const createOnCancel = (payload: {|+sessionID: number|}) => ({error: false, payload, type: onCancel})
export const createOnSubmit = (payload: {|+sessionID: number|}) => ({error: false, payload, type: onSubmit})
export const createRegisterPinentryListener = (payload: {|+started: boolean|}) => ({error: false, payload, type: registerPinentryListener})

// Action Payloads
export type NewPinentryPayload = More.ReturnType<typeof createNewPinentry>
export type OnCancelPayload = More.ReturnType<typeof createOnCancel>
export type OnSubmitPayload = More.ReturnType<typeof createOnSubmit>
export type RegisterPinentryListenerPayload = More.ReturnType<typeof createRegisterPinentryListener>

// All Actions
// prettier-ignore
export type Actions =
  | More.ReturnType<typeof createNewPinentry>
  | More.ReturnType<typeof createOnCancel>
  | More.ReturnType<typeof createOnSubmit>
  | More.ReturnType<typeof createRegisterPinentryListener>
  | {type: 'common:resetStore', payload: void}
