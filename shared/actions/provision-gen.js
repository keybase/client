// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier,no-use-before-define */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Types from '../constants/types/provision'
import HiddenString from '../util/hidden-string'
import {RPCError} from '../util/errors'

// Constants
export const resetStore = 'common:resetStore' // not a part of provision but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'provision:'
export const addNewDevice = 'provision:addNewDevice'
export const provisionError = 'provision:provisionError'
export const showCodePage = 'provision:showCodePage'
export const showDeviceListPage = 'provision:showDeviceListPage'
export const showFinalErrorPage = 'provision:showFinalErrorPage'
export const showGPGPage = 'provision:showGPGPage'
export const showNewDeviceNamePage = 'provision:showNewDeviceNamePage'
export const showPaperkeyPage = 'provision:showPaperkeyPage'
export const showPassphrasePage = 'provision:showPassphrasePage'
export const startProvision = 'provision:startProvision'
export const submitDeviceName = 'provision:submitDeviceName'
export const submitDeviceSelect = 'provision:submitDeviceSelect'
export const submitGPGMethod = 'provision:submitGPGMethod'
export const submitGPGSignOK = 'provision:submitGPGSignOK'
export const submitPaperkey = 'provision:submitPaperkey'
export const submitPassphrase = 'provision:submitPassphrase'
export const submitTextCode = 'provision:submitTextCode'
export const submitUsernameOrEmail = 'provision:submitUsernameOrEmail'
export const switchToGPGSignOnly = 'provision:switchToGPGSignOnly'

// Payload Types
type _AddNewDevicePayload = $ReadOnly<{|otherDeviceType: 'desktop' | 'mobile'|}>
type _ProvisionErrorPayload = $ReadOnly<{|error: ?HiddenString|}>
type _ShowCodePagePayload = $ReadOnly<{|
  code: HiddenString,
  error: ?HiddenString,
|}>
type _ShowDeviceListPagePayload = $ReadOnly<{|devices: Array<Types.Device>|}>
type _ShowFinalErrorPagePayload = $ReadOnly<{|
  finalError: RPCError,
  fromDeviceAdd: boolean,
|}>
type _ShowGPGPagePayload = void
type _ShowNewDeviceNamePagePayload = $ReadOnly<{|
  existingDevices: Array<string>,
  error: ?HiddenString,
|}>
type _ShowPaperkeyPagePayload = $ReadOnly<{|error: ?HiddenString|}>
type _ShowPassphrasePagePayload = $ReadOnly<{|error: ?HiddenString|}>
type _StartProvisionPayload = void
type _SubmitDeviceNamePayload = $ReadOnly<{|name: string|}>
type _SubmitDeviceSelectPayload = $ReadOnly<{|name: string|}>
type _SubmitGPGMethodPayload = $ReadOnly<{|exportKey: boolean|}>
type _SubmitGPGSignOKPayload = $ReadOnly<{|accepted: boolean|}>
type _SubmitPaperkeyPayload = $ReadOnly<{|paperkey: HiddenString|}>
type _SubmitPassphrasePayload = $ReadOnly<{|passphrase: HiddenString|}>
type _SubmitTextCodePayload = $ReadOnly<{|phrase: HiddenString|}>
type _SubmitUsernameOrEmailPayload = $ReadOnly<{|usernameOrEmail: string|}>
type _SwitchToGPGSignOnlyPayload = $ReadOnly<{|importError: string|}>

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
export const createShowFinalErrorPage = (payload: _ShowFinalErrorPagePayload) => ({error: false, payload, type: showFinalErrorPage})
export const createShowGPGPage = (payload: _ShowGPGPagePayload) => ({error: false, payload, type: showGPGPage})
export const createShowPaperkeyPage = (payload: _ShowPaperkeyPagePayload) => ({error: false, payload, type: showPaperkeyPage})
export const createShowPassphrasePage = (payload: _ShowPassphrasePagePayload) => ({error: false, payload, type: showPassphrasePage})
export const createStartProvision = (payload: _StartProvisionPayload) => ({error: false, payload, type: startProvision})
export const createSubmitDeviceName = (payload: _SubmitDeviceNamePayload) => ({error: false, payload, type: submitDeviceName})
export const createSubmitDeviceSelect = (payload: _SubmitDeviceSelectPayload) => ({error: false, payload, type: submitDeviceSelect})
export const createSubmitGPGMethod = (payload: _SubmitGPGMethodPayload) => ({error: false, payload, type: submitGPGMethod})
export const createSubmitGPGSignOK = (payload: _SubmitGPGSignOKPayload) => ({error: false, payload, type: submitGPGSignOK})
export const createSubmitPaperkey = (payload: _SubmitPaperkeyPayload) => ({error: false, payload, type: submitPaperkey})
export const createSubmitPassphrase = (payload: _SubmitPassphrasePayload) => ({error: false, payload, type: submitPassphrase})
export const createSubmitTextCode = (payload: _SubmitTextCodePayload) => ({error: false, payload, type: submitTextCode})
export const createSubmitUsernameOrEmail = (payload: _SubmitUsernameOrEmailPayload) => ({error: false, payload, type: submitUsernameOrEmail})
export const createSwitchToGPGSignOnly = (payload: _SwitchToGPGSignOnlyPayload) => ({error: false, payload, type: switchToGPGSignOnly})

// Action Payloads
export type AddNewDevicePayload = $Call<typeof createAddNewDevice, _AddNewDevicePayload>
export type ProvisionErrorPayload = $Call<typeof createProvisionError, _ProvisionErrorPayload>
export type ShowCodePagePayload = $Call<typeof createShowCodePage, _ShowCodePagePayload>
export type ShowDeviceListPagePayload = $Call<typeof createShowDeviceListPage, _ShowDeviceListPagePayload>
export type ShowFinalErrorPagePayload = $Call<typeof createShowFinalErrorPage, _ShowFinalErrorPagePayload>
export type ShowGPGPagePayload = $Call<typeof createShowGPGPage, _ShowGPGPagePayload>
export type ShowNewDeviceNamePagePayload = $Call<typeof createShowNewDeviceNamePage, _ShowNewDeviceNamePagePayload>
export type ShowPaperkeyPagePayload = $Call<typeof createShowPaperkeyPage, _ShowPaperkeyPagePayload>
export type ShowPassphrasePagePayload = $Call<typeof createShowPassphrasePage, _ShowPassphrasePagePayload>
export type StartProvisionPayload = $Call<typeof createStartProvision, _StartProvisionPayload>
export type SubmitDeviceNamePayload = $Call<typeof createSubmitDeviceName, _SubmitDeviceNamePayload>
export type SubmitDeviceSelectPayload = $Call<typeof createSubmitDeviceSelect, _SubmitDeviceSelectPayload>
export type SubmitGPGMethodPayload = $Call<typeof createSubmitGPGMethod, _SubmitGPGMethodPayload>
export type SubmitGPGSignOKPayload = $Call<typeof createSubmitGPGSignOK, _SubmitGPGSignOKPayload>
export type SubmitPaperkeyPayload = $Call<typeof createSubmitPaperkey, _SubmitPaperkeyPayload>
export type SubmitPassphrasePayload = $Call<typeof createSubmitPassphrase, _SubmitPassphrasePayload>
export type SubmitTextCodePayload = $Call<typeof createSubmitTextCode, _SubmitTextCodePayload>
export type SubmitUsernameOrEmailPayload = $Call<typeof createSubmitUsernameOrEmail, _SubmitUsernameOrEmailPayload>
export type SwitchToGPGSignOnlyPayload = $Call<typeof createSwitchToGPGSignOnly, _SwitchToGPGSignOnlyPayload>

// All Actions
// prettier-ignore
export type Actions =
  | AddNewDevicePayload
  | ProvisionErrorPayload
  | ShowCodePagePayload
  | ShowDeviceListPagePayload
  | ShowFinalErrorPagePayload
  | ShowGPGPagePayload
  | ShowNewDeviceNamePagePayload
  | ShowPaperkeyPagePayload
  | ShowPassphrasePagePayload
  | StartProvisionPayload
  | SubmitDeviceNamePayload
  | SubmitDeviceSelectPayload
  | SubmitGPGMethodPayload
  | SubmitGPGSignOKPayload
  | SubmitPaperkeyPayload
  | SubmitPassphrasePayload
  | SubmitTextCodePayload
  | SubmitUsernameOrEmailPayload
  | SwitchToGPGSignOnlyPayload
  | {type: 'common:resetStore', payload: void}
