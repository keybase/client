// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/flow-types'
import * as More from '../constants/types/more'
import * as Types from '../constants/types/pinentry'

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

// Reducer type
// prettier-ignore
export type ReducerMap = {|'common:resetStore': (state: Types.State, action: {type: 'common:resetStore', payload: void}) => Types.State, 'pinentry:newPinentry': (state: Types.State, action: NewPinentryPayload) => Types.State, 'pinentry:onCancel': (state: Types.State, action: OnCancelPayload) => Types.State, 'pinentry:onSubmit': (state: Types.State, action: OnSubmitPayload) => Types.State, 'pinentry:registerPinentryListener': (state: Types.State, action: RegisterPinentryListenerPayload) => Types.State|}

// All Actions
// prettier-ignore
export type Actions = NewPinentryPayload | OnCancelPayload | OnSubmitPayload | RegisterPinentryListenerPayload | {type: 'common:resetStore', payload: void}
