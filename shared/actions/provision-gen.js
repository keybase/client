// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier,no-use-before-define,import/no-duplicates */

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
type _ShowCodePagePayload = $ReadOnly<{|code: HiddenString, error: ?HiddenString|}>
type _ShowDeviceListPagePayload = $ReadOnly<{|devices: Array<Types.Device>|}>
type _ShowFinalErrorPagePayload = $ReadOnly<{|finalError: RPCError, fromDeviceAdd: boolean|}>
type _ShowGPGPagePayload = void
type _ShowNewDeviceNamePagePayload = $ReadOnly<{|existingDevices: Array<string>, error: ?HiddenString|}>
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
export const createShowNewDeviceNamePage = (payload: _ShowNewDeviceNamePagePayload) => ({payload, type: showNewDeviceNamePage})
/**
 * Show the list of devices the user can use to provision a device
 */
export const createShowDeviceListPage = (payload: _ShowDeviceListPagePayload) => ({payload, type: showDeviceListPage})
export const createAddNewDevice = (payload: _AddNewDevicePayload) => ({payload, type: addNewDevice})
export const createProvisionError = (payload: _ProvisionErrorPayload) => ({payload, type: provisionError})
export const createShowCodePage = (payload: _ShowCodePagePayload) => ({payload, type: showCodePage})
export const createShowFinalErrorPage = (payload: _ShowFinalErrorPagePayload) => ({payload, type: showFinalErrorPage})
export const createShowGPGPage = (payload: _ShowGPGPagePayload) => ({payload, type: showGPGPage})
export const createShowPaperkeyPage = (payload: _ShowPaperkeyPagePayload) => ({payload, type: showPaperkeyPage})
export const createShowPassphrasePage = (payload: _ShowPassphrasePagePayload) => ({payload, type: showPassphrasePage})
export const createStartProvision = (payload: _StartProvisionPayload) => ({payload, type: startProvision})
export const createSubmitDeviceName = (payload: _SubmitDeviceNamePayload) => ({payload, type: submitDeviceName})
export const createSubmitDeviceSelect = (payload: _SubmitDeviceSelectPayload) => ({payload, type: submitDeviceSelect})
export const createSubmitGPGMethod = (payload: _SubmitGPGMethodPayload) => ({payload, type: submitGPGMethod})
export const createSubmitGPGSignOK = (payload: _SubmitGPGSignOKPayload) => ({payload, type: submitGPGSignOK})
export const createSubmitPaperkey = (payload: _SubmitPaperkeyPayload) => ({payload, type: submitPaperkey})
export const createSubmitPassphrase = (payload: _SubmitPassphrasePayload) => ({payload, type: submitPassphrase})
export const createSubmitTextCode = (payload: _SubmitTextCodePayload) => ({payload, type: submitTextCode})
export const createSubmitUsernameOrEmail = (payload: _SubmitUsernameOrEmailPayload) => ({payload, type: submitUsernameOrEmail})
export const createSwitchToGPGSignOnly = (payload: _SwitchToGPGSignOnlyPayload) => ({payload, type: switchToGPGSignOnly})

// Action Payloads
export type AddNewDevicePayload = {|+payload: _AddNewDevicePayload, +type: 'provision:addNewDevice'|}
export type ProvisionErrorPayload = {|+payload: _ProvisionErrorPayload, +type: 'provision:provisionError'|}
export type ShowCodePagePayload = {|+payload: _ShowCodePagePayload, +type: 'provision:showCodePage'|}
export type ShowDeviceListPagePayload = {|+payload: _ShowDeviceListPagePayload, +type: 'provision:showDeviceListPage'|}
export type ShowFinalErrorPagePayload = {|+payload: _ShowFinalErrorPagePayload, +type: 'provision:showFinalErrorPage'|}
export type ShowGPGPagePayload = {|+payload: _ShowGPGPagePayload, +type: 'provision:showGPGPage'|}
export type ShowNewDeviceNamePagePayload = {|+payload: _ShowNewDeviceNamePagePayload, +type: 'provision:showNewDeviceNamePage'|}
export type ShowPaperkeyPagePayload = {|+payload: _ShowPaperkeyPagePayload, +type: 'provision:showPaperkeyPage'|}
export type ShowPassphrasePagePayload = {|+payload: _ShowPassphrasePagePayload, +type: 'provision:showPassphrasePage'|}
export type StartProvisionPayload = {|+payload: _StartProvisionPayload, +type: 'provision:startProvision'|}
export type SubmitDeviceNamePayload = {|+payload: _SubmitDeviceNamePayload, +type: 'provision:submitDeviceName'|}
export type SubmitDeviceSelectPayload = {|+payload: _SubmitDeviceSelectPayload, +type: 'provision:submitDeviceSelect'|}
export type SubmitGPGMethodPayload = {|+payload: _SubmitGPGMethodPayload, +type: 'provision:submitGPGMethod'|}
export type SubmitGPGSignOKPayload = {|+payload: _SubmitGPGSignOKPayload, +type: 'provision:submitGPGSignOK'|}
export type SubmitPaperkeyPayload = {|+payload: _SubmitPaperkeyPayload, +type: 'provision:submitPaperkey'|}
export type SubmitPassphrasePayload = {|+payload: _SubmitPassphrasePayload, +type: 'provision:submitPassphrase'|}
export type SubmitTextCodePayload = {|+payload: _SubmitTextCodePayload, +type: 'provision:submitTextCode'|}
export type SubmitUsernameOrEmailPayload = {|+payload: _SubmitUsernameOrEmailPayload, +type: 'provision:submitUsernameOrEmail'|}
export type SwitchToGPGSignOnlyPayload = {|+payload: _SwitchToGPGSignOnlyPayload, +type: 'provision:switchToGPGSignOnly'|}

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
  | {type: 'common:resetStore', payload: null}
