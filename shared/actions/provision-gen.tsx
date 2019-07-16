// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate

import * as Types from '../constants/types/provision'
import HiddenString from '../util/hidden-string'
import {RPCError} from '../util/errors'

// Constants
export const resetStore = 'common:resetStore' // not a part of provision but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'provision:'
export const addNewDevice = 'provision:addNewDevice'
export const forgotUsername = 'provision:forgotUsername'
export const forgotUsernameResult = 'provision:forgotUsernameResult'
export const provisionError = 'provision:provisionError'
export const showCodePage = 'provision:showCodePage'
export const showDeviceListPage = 'provision:showDeviceListPage'
export const showFinalErrorPage = 'provision:showFinalErrorPage'
export const showGPGPage = 'provision:showGPGPage'
export const showInlineError = 'provision:showInlineError'
export const showNewDeviceNamePage = 'provision:showNewDeviceNamePage'
export const showPaperkeyPage = 'provision:showPaperkeyPage'
export const showPasswordPage = 'provision:showPasswordPage'
export const startProvision = 'provision:startProvision'
export const submitDeviceName = 'provision:submitDeviceName'
export const submitDeviceSelect = 'provision:submitDeviceSelect'
export const submitGPGMethod = 'provision:submitGPGMethod'
export const submitGPGSignOK = 'provision:submitGPGSignOK'
export const submitPaperkey = 'provision:submitPaperkey'
export const submitPassword = 'provision:submitPassword'
export const submitTextCode = 'provision:submitTextCode'
export const submitUsername = 'provision:submitUsername'
export const switchToGPGSignOnly = 'provision:switchToGPGSignOnly'

// Payload Types
type _AddNewDevicePayload = {readonly otherDeviceType: 'desktop' | 'mobile'}
type _ForgotUsernamePayload = {readonly email: string}
type _ForgotUsernameResultPayload = {readonly result: string}
type _ProvisionErrorPayload = {readonly error: HiddenString | null}
type _ShowCodePagePayload = {readonly code: HiddenString; readonly error: HiddenString | null}
type _ShowDeviceListPagePayload = {readonly devices: Array<Types.Device>}
type _ShowFinalErrorPagePayload = {readonly finalError: RPCError; readonly fromDeviceAdd: boolean}
type _ShowGPGPagePayload = void
type _ShowInlineErrorPayload = {readonly inlineError: RPCError}
type _ShowNewDeviceNamePagePayload = {
  readonly existingDevices: Array<string>
  readonly error: HiddenString | null
}
type _ShowPaperkeyPagePayload = {readonly error: HiddenString | null}
type _ShowPasswordPagePayload = {readonly error: HiddenString | null}
type _StartProvisionPayload = {readonly initUsername?: string}
type _SubmitDeviceNamePayload = {readonly name: string}
type _SubmitDeviceSelectPayload = {readonly name: string}
type _SubmitGPGMethodPayload = {readonly exportKey: boolean}
type _SubmitGPGSignOKPayload = {readonly accepted: boolean}
type _SubmitPaperkeyPayload = {readonly paperkey: HiddenString}
type _SubmitPasswordPayload = {readonly password: HiddenString}
type _SubmitTextCodePayload = {readonly phrase: HiddenString}
type _SubmitUsernamePayload = {readonly username: string}
type _SwitchToGPGSignOnlyPayload = {readonly importError: string}

// Action Creators
/**
 * Ask the user for a new device name
 */
export const createShowNewDeviceNamePage = (
  payload: _ShowNewDeviceNamePagePayload
): ShowNewDeviceNamePagePayload => ({payload, type: showNewDeviceNamePage})
/**
 * Show the list of devices the user can use to provision a device
 */
export const createShowDeviceListPage = (payload: _ShowDeviceListPagePayload): ShowDeviceListPagePayload => ({
  payload,
  type: showDeviceListPage,
})
export const createAddNewDevice = (payload: _AddNewDevicePayload): AddNewDevicePayload => ({
  payload,
  type: addNewDevice,
})
export const createForgotUsername = (payload: _ForgotUsernamePayload): ForgotUsernamePayload => ({
  payload,
  type: forgotUsername,
})
export const createForgotUsernameResult = (
  payload: _ForgotUsernameResultPayload
): ForgotUsernameResultPayload => ({payload, type: forgotUsernameResult})
export const createProvisionError = (payload: _ProvisionErrorPayload): ProvisionErrorPayload => ({
  payload,
  type: provisionError,
})
export const createShowCodePage = (payload: _ShowCodePagePayload): ShowCodePagePayload => ({
  payload,
  type: showCodePage,
})
export const createShowFinalErrorPage = (payload: _ShowFinalErrorPagePayload): ShowFinalErrorPagePayload => ({
  payload,
  type: showFinalErrorPage,
})
export const createShowGPGPage = (payload: _ShowGPGPagePayload): ShowGPGPagePayload => ({
  payload,
  type: showGPGPage,
})
export const createShowInlineError = (payload: _ShowInlineErrorPayload): ShowInlineErrorPayload => ({
  payload,
  type: showInlineError,
})
export const createShowPaperkeyPage = (payload: _ShowPaperkeyPagePayload): ShowPaperkeyPagePayload => ({
  payload,
  type: showPaperkeyPage,
})
export const createShowPasswordPage = (payload: _ShowPasswordPagePayload): ShowPasswordPagePayload => ({
  payload,
  type: showPasswordPage,
})
export const createStartProvision = (
  payload: _StartProvisionPayload = Object.freeze({})
): StartProvisionPayload => ({payload, type: startProvision})
export const createSubmitDeviceName = (payload: _SubmitDeviceNamePayload): SubmitDeviceNamePayload => ({
  payload,
  type: submitDeviceName,
})
export const createSubmitDeviceSelect = (payload: _SubmitDeviceSelectPayload): SubmitDeviceSelectPayload => ({
  payload,
  type: submitDeviceSelect,
})
export const createSubmitGPGMethod = (payload: _SubmitGPGMethodPayload): SubmitGPGMethodPayload => ({
  payload,
  type: submitGPGMethod,
})
export const createSubmitGPGSignOK = (payload: _SubmitGPGSignOKPayload): SubmitGPGSignOKPayload => ({
  payload,
  type: submitGPGSignOK,
})
export const createSubmitPaperkey = (payload: _SubmitPaperkeyPayload): SubmitPaperkeyPayload => ({
  payload,
  type: submitPaperkey,
})
export const createSubmitPassword = (payload: _SubmitPasswordPayload): SubmitPasswordPayload => ({
  payload,
  type: submitPassword,
})
export const createSubmitTextCode = (payload: _SubmitTextCodePayload): SubmitTextCodePayload => ({
  payload,
  type: submitTextCode,
})
export const createSubmitUsername = (payload: _SubmitUsernamePayload): SubmitUsernamePayload => ({
  payload,
  type: submitUsername,
})
export const createSwitchToGPGSignOnly = (
  payload: _SwitchToGPGSignOnlyPayload
): SwitchToGPGSignOnlyPayload => ({payload, type: switchToGPGSignOnly})

// Action Payloads
export type AddNewDevicePayload = {readonly payload: _AddNewDevicePayload; readonly type: typeof addNewDevice}
export type ForgotUsernamePayload = {
  readonly payload: _ForgotUsernamePayload
  readonly type: typeof forgotUsername
}
export type ForgotUsernameResultPayload = {
  readonly payload: _ForgotUsernameResultPayload
  readonly type: typeof forgotUsernameResult
}
export type ProvisionErrorPayload = {
  readonly payload: _ProvisionErrorPayload
  readonly type: typeof provisionError
}
export type ShowCodePagePayload = {readonly payload: _ShowCodePagePayload; readonly type: typeof showCodePage}
export type ShowDeviceListPagePayload = {
  readonly payload: _ShowDeviceListPagePayload
  readonly type: typeof showDeviceListPage
}
export type ShowFinalErrorPagePayload = {
  readonly payload: _ShowFinalErrorPagePayload
  readonly type: typeof showFinalErrorPage
}
export type ShowGPGPagePayload = {readonly payload: _ShowGPGPagePayload; readonly type: typeof showGPGPage}
export type ShowInlineErrorPayload = {
  readonly payload: _ShowInlineErrorPayload
  readonly type: typeof showInlineError
}
export type ShowNewDeviceNamePagePayload = {
  readonly payload: _ShowNewDeviceNamePagePayload
  readonly type: typeof showNewDeviceNamePage
}
export type ShowPaperkeyPagePayload = {
  readonly payload: _ShowPaperkeyPagePayload
  readonly type: typeof showPaperkeyPage
}
export type ShowPasswordPagePayload = {
  readonly payload: _ShowPasswordPagePayload
  readonly type: typeof showPasswordPage
}
export type StartProvisionPayload = {
  readonly payload: _StartProvisionPayload
  readonly type: typeof startProvision
}
export type SubmitDeviceNamePayload = {
  readonly payload: _SubmitDeviceNamePayload
  readonly type: typeof submitDeviceName
}
export type SubmitDeviceSelectPayload = {
  readonly payload: _SubmitDeviceSelectPayload
  readonly type: typeof submitDeviceSelect
}
export type SubmitGPGMethodPayload = {
  readonly payload: _SubmitGPGMethodPayload
  readonly type: typeof submitGPGMethod
}
export type SubmitGPGSignOKPayload = {
  readonly payload: _SubmitGPGSignOKPayload
  readonly type: typeof submitGPGSignOK
}
export type SubmitPaperkeyPayload = {
  readonly payload: _SubmitPaperkeyPayload
  readonly type: typeof submitPaperkey
}
export type SubmitPasswordPayload = {
  readonly payload: _SubmitPasswordPayload
  readonly type: typeof submitPassword
}
export type SubmitTextCodePayload = {
  readonly payload: _SubmitTextCodePayload
  readonly type: typeof submitTextCode
}
export type SubmitUsernamePayload = {
  readonly payload: _SubmitUsernamePayload
  readonly type: typeof submitUsername
}
export type SwitchToGPGSignOnlyPayload = {
  readonly payload: _SwitchToGPGSignOnlyPayload
  readonly type: typeof switchToGPGSignOnly
}

// All Actions
// prettier-ignore
export type Actions =
  | AddNewDevicePayload
  | ForgotUsernamePayload
  | ForgotUsernameResultPayload
  | ProvisionErrorPayload
  | ShowCodePagePayload
  | ShowDeviceListPagePayload
  | ShowFinalErrorPagePayload
  | ShowGPGPagePayload
  | ShowInlineErrorPayload
  | ShowNewDeviceNamePagePayload
  | ShowPaperkeyPagePayload
  | ShowPasswordPagePayload
  | StartProvisionPayload
  | SubmitDeviceNamePayload
  | SubmitDeviceSelectPayload
  | SubmitGPGMethodPayload
  | SubmitGPGSignOKPayload
  | SubmitPaperkeyPayload
  | SubmitPasswordPayload
  | SubmitTextCodePayload
  | SubmitUsernamePayload
  | SwitchToGPGSignOnlyPayload
  | {type: 'common:resetStore', payload: {}}
