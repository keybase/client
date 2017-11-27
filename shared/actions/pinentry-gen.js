// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/flow-types'
import * as More from '../constants/types/more'
import * as Constants from '../constants/pinentry'

// Constants
export const resetStore = 'common:resetStore' // not a part of pinentry but is handled by every reducer
export const deleteEntity = 'pinentry:deleteEntity'
export const mergeEntity = 'pinentry:mergeEntity'
export const newPinentry = 'pinentry:newPinentry'
export const onCancel = 'pinentry:onCancel'
export const onSubmit = 'pinentry:onSubmit'
export const registerPinentryListener = 'pinentry:registerPinentryListener'
export const replaceEntity = 'pinentry:replaceEntity'
export const subtractEntity = 'pinentry:subtractEntity'

// Action Creators
export const createDeleteEntity = (payload: {|+keyPath: Array<string>, +ids: Iterable<string>|}) => ({error: false, payload, type: deleteEntity})
export const createMergeEntity = (payload: {|+keyPath: Array<string>, +entities: I.Map<any, any> | I.List<any>|}) => ({error: false, payload, type: mergeEntity})
export const createNewPinentry = (payload: {|+features: RPCTypes.GUIEntryFeatures, +type: RPCTypes.PassphraseType, +sessionID: number, +prompt: string, +windowTitle: string, +submitLabel: ?string, +cancelLabel: ?string, +retryLabel: ?string|}) => ({error: false, payload, type: newPinentry})
export const createOnCancel = (payload: {|+sessionID: number|}) => ({error: false, payload, type: onCancel})
export const createOnSubmit = (payload: {|+sessionID: number, +passphrase: string, +features: RPCTypes.GUIEntryFeatures|}) => ({error: false, payload, type: onSubmit})
export const createRegisterPinentryListener = () => ({error: false, payload: undefined, type: registerPinentryListener})
export const createReplaceEntity = (payload: {|+keyPath: Array<string>, +entities: I.Map<any, any> | I.List<any>|}) => ({error: false, payload, type: replaceEntity})
export const createSubtractEntity = (payload: {|+keyPath: Array<string>, +entities: I.List<any>|}) => ({error: false, payload, type: subtractEntity})

// Action Payloads
export type DeleteEntityPayload = More.ReturnType<typeof createDeleteEntity>
export type MergeEntityPayload = More.ReturnType<typeof createMergeEntity>
export type NewPinentryPayload = More.ReturnType<typeof createNewPinentry>
export type OnCancelPayload = More.ReturnType<typeof createOnCancel>
export type OnSubmitPayload = More.ReturnType<typeof createOnSubmit>
export type RegisterPinentryListenerPayload = More.ReturnType<typeof createRegisterPinentryListener>
export type ReplaceEntityPayload = More.ReturnType<typeof createReplaceEntity>
export type SubtractEntityPayload = More.ReturnType<typeof createSubtractEntity>

// All Actions
// prettier-ignore
export type Actions =
  | More.ReturnType<typeof createDeleteEntity>
  | More.ReturnType<typeof createMergeEntity>
  | More.ReturnType<typeof createNewPinentry>
  | More.ReturnType<typeof createOnCancel>
  | More.ReturnType<typeof createOnSubmit>
  | More.ReturnType<typeof createRegisterPinentryListener>
  | More.ReturnType<typeof createReplaceEntity>
  | More.ReturnType<typeof createSubtractEntity>
  | {type: 'common:resetStore', payload: void}
