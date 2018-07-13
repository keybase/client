// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier,no-use-before-define */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Types from '../constants/types/provision'
import HiddenString from '../util/hidden-string'

// Constants
export const resetStore = 'common:resetStore' // not a part of provision but is handled by every reducer
export const addNewDevice = 'provision:addNewDevice'
export const provisionError = 'provision:provisionError'
export const showCodePage = 'provision:showCodePage'
export const showDeviceListPage = 'provision:showDeviceListPage'
export const showGPGPage = 'provision:showGPGPage'
export const showNewDeviceNamePage = 'provision:showNewDeviceNamePage'
export const showPassphrasePage = 'provision:showPassphrasePage'
export const submitProvisionDeviceName = 'provision:submitProvisionDeviceName'
export const submitProvisionDeviceSelect = 'provision:submitProvisionDeviceSelect'
export const submitProvisionGPGMethod = 'provision:submitProvisionGPGMethod'
export const submitProvisionPassphrase = 'provision:submitProvisionPassphrase'
export const submitProvisionPasswordInsteadOfDevice = 'provision:submitProvisionPasswordInsteadOfDevice'
export const submitProvisionTextCode = 'provision:submitProvisionTextCode'
export const submitUsernameOrEmail = 'provision:submitUsernameOrEmail'

// Payload Types
type _AddNewDevicePayload = $ReadOnly<{|otherDeviceType: 'desktop' | 'phone' | 'paperkey'|}>
type _ProvisionErrorPayload = $ReadOnly<{|error: ?HiddenString|}>
type _ShowCodePagePayload = $ReadOnly<{|
  code: HiddenString,
  error: ?HiddenString,
|}>
type _ShowDeviceListPagePayload = $ReadOnly<{|
  canSelectNoDevice: boolean,
  devices: Array<Types.Device>,
|}>
type _ShowGPGPagePayload = void
type _ShowNewDeviceNamePagePayload = $ReadOnly<{|
  existingDevices: Array<string>,
  error: ?HiddenString,
|}>
type _ShowPassphrasePagePayload = $ReadOnly<{|error: ?HiddenString|}>
type _SubmitProvisionDeviceNamePayload = $ReadOnly<{|name: string|}>
type _SubmitProvisionDeviceSelectPayload = $ReadOnly<{|name: string|}>
type _SubmitProvisionGPGMethodPayload = $ReadOnly<{|exportKey: boolean|}>
type _SubmitProvisionPassphrasePayload = $ReadOnly<{|passphrase: HiddenString|}>
type _SubmitProvisionPasswordInsteadOfDevicePayload = void
type _SubmitProvisionTextCodePayload = $ReadOnly<{|phrase: HiddenString|}>
type _SubmitUsernameOrEmailPayload = $ReadOnly<{|usernameOrEmail: string|}>

// Action Creators
/**
 * Ask the user for a new device name
 */
export const createShowNewDeviceNamePage = (payload: _ShowNewDeviceNamePagePayload) => ({error: false, payload, type: showNewDeviceNamePage})
/**
 * Show the list of devices the user can use to provision a device
 */
export const createShowDeviceListPage = (payload: _ShowDeviceListPagePayload) => ({error: false, payload, type: showDeviceListPage})
export const createAddNewDevice = (payload: _AddNewDevicePayload) => ({error: false, payload, type: addNewDevice})
export const createProvisionError = (payload: _ProvisionErrorPayload) => ({error: false, payload, type: provisionError})
export const createShowCodePage = (payload: _ShowCodePagePayload) => ({error: false, payload, type: showCodePage})
export const createShowGPGPage = (payload: _ShowGPGPagePayload) => ({error: false, payload, type: showGPGPage})
export const createShowPassphrasePage = (payload: _ShowPassphrasePagePayload) => ({error: false, payload, type: showPassphrasePage})
export const createSubmitProvisionDeviceName = (payload: _SubmitProvisionDeviceNamePayload) => ({error: false, payload, type: submitProvisionDeviceName})
export const createSubmitProvisionDeviceSelect = (payload: _SubmitProvisionDeviceSelectPayload) => ({error: false, payload, type: submitProvisionDeviceSelect})
export const createSubmitProvisionGPGMethod = (payload: _SubmitProvisionGPGMethodPayload) => ({error: false, payload, type: submitProvisionGPGMethod})
export const createSubmitProvisionPassphrase = (payload: _SubmitProvisionPassphrasePayload) => ({error: false, payload, type: submitProvisionPassphrase})
export const createSubmitProvisionPasswordInsteadOfDevice = (payload: _SubmitProvisionPasswordInsteadOfDevicePayload) => ({error: false, payload, type: submitProvisionPasswordInsteadOfDevice})
export const createSubmitProvisionTextCode = (payload: _SubmitProvisionTextCodePayload) => ({error: false, payload, type: submitProvisionTextCode})
export const createSubmitUsernameOrEmail = (payload: _SubmitUsernameOrEmailPayload) => ({error: false, payload, type: submitUsernameOrEmail})

// Action Payloads
export type AddNewDevicePayload = $Call<typeof createAddNewDevice, _AddNewDevicePayload>
export type ProvisionErrorPayload = $Call<typeof createProvisionError, _ProvisionErrorPayload>
export type ShowCodePagePayload = $Call<typeof createShowCodePage, _ShowCodePagePayload>
export type ShowDeviceListPagePayload = $Call<typeof createShowDeviceListPage, _ShowDeviceListPagePayload>
export type ShowGPGPagePayload = $Call<typeof createShowGPGPage, _ShowGPGPagePayload>
export type ShowNewDeviceNamePagePayload = $Call<typeof createShowNewDeviceNamePage, _ShowNewDeviceNamePagePayload>
export type ShowPassphrasePagePayload = $Call<typeof createShowPassphrasePage, _ShowPassphrasePagePayload>
export type SubmitProvisionDeviceNamePayload = $Call<typeof createSubmitProvisionDeviceName, _SubmitProvisionDeviceNamePayload>
export type SubmitProvisionDeviceSelectPayload = $Call<typeof createSubmitProvisionDeviceSelect, _SubmitProvisionDeviceSelectPayload>
export type SubmitProvisionGPGMethodPayload = $Call<typeof createSubmitProvisionGPGMethod, _SubmitProvisionGPGMethodPayload>
export type SubmitProvisionPassphrasePayload = $Call<typeof createSubmitProvisionPassphrase, _SubmitProvisionPassphrasePayload>
export type SubmitProvisionPasswordInsteadOfDevicePayload = $Call<typeof createSubmitProvisionPasswordInsteadOfDevice, _SubmitProvisionPasswordInsteadOfDevicePayload>
export type SubmitProvisionTextCodePayload = $Call<typeof createSubmitProvisionTextCode, _SubmitProvisionTextCodePayload>
export type SubmitUsernameOrEmailPayload = $Call<typeof createSubmitUsernameOrEmail, _SubmitUsernameOrEmailPayload>

// All Actions
// prettier-ignore
export type Actions =
  | AddNewDevicePayload
  | ProvisionErrorPayload
  | ShowCodePagePayload
  | ShowDeviceListPagePayload
  | ShowGPGPagePayload
  | ShowNewDeviceNamePagePayload
  | ShowPassphrasePagePayload
  | SubmitProvisionDeviceNamePayload
  | SubmitProvisionDeviceSelectPayload
  | SubmitProvisionGPGMethodPayload
  | SubmitProvisionPassphrasePayload
  | SubmitProvisionPasswordInsteadOfDevicePayload
  | SubmitProvisionTextCodePayload
  | SubmitUsernameOrEmailPayload
  | {type: 'common:resetStore', payload: void}
