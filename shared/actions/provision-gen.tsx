// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate

import type * as Types from '../constants/types/provision'
import type HiddenString from '../util/hidden-string'
import type {RPCError} from '../util/errors'

// Constants
export const resetStore = 'common:resetStore' // not a part of provision but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'provision:'
export const addNewDevice = 'provision:addNewDevice'
export const backToDeviceList = 'provision:backToDeviceList'
export const cancelProvision = 'provision:cancelProvision'
export const forgotUsername = 'provision:forgotUsername'
export const forgotUsernameResult = 'provision:forgotUsernameResult'
export const provisionDone = 'provision:provisionDone'
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

// Action Creators
/**
 * Ask the user for a new device name
 */
export const createShowNewDeviceNamePage = (payload: {
  readonly existingDevices: Array<string>
  readonly error: HiddenString | null
}) => ({payload, type: showNewDeviceNamePage as typeof showNewDeviceNamePage})
/**
 * Show the list of devices the user can use to provision a device
 */
export const createShowDeviceListPage = (payload: {readonly devices: Array<Types.Device>}) => ({
  payload,
  type: showDeviceListPage as typeof showDeviceListPage,
})
/**
 * We're no longer holding an open provisioning session; it is safe to start another.
 */
export const createProvisionDone = (payload?: undefined) => ({
  payload,
  type: provisionDone as typeof provisionDone,
})
export const createAddNewDevice = (payload: {readonly otherDeviceType: 'desktop' | 'mobile'}) => ({
  payload,
  type: addNewDevice as typeof addNewDevice,
})
export const createBackToDeviceList = (payload: {readonly username: string}) => ({
  payload,
  type: backToDeviceList as typeof backToDeviceList,
})
export const createCancelProvision = (payload?: undefined) => ({
  payload,
  type: cancelProvision as typeof cancelProvision,
})
export const createForgotUsername = (payload: {readonly email?: string; readonly phone?: string} = {}) => ({
  payload,
  type: forgotUsername as typeof forgotUsername,
})
export const createForgotUsernameResult = (payload: {readonly result: string}) => ({
  payload,
  type: forgotUsernameResult as typeof forgotUsernameResult,
})
export const createProvisionError = (payload: {readonly error: HiddenString | null}) => ({
  payload,
  type: provisionError as typeof provisionError,
})
export const createShowCodePage = (payload: {
  readonly code: HiddenString
  readonly error: HiddenString | null
}) => ({payload, type: showCodePage as typeof showCodePage})
export const createShowFinalErrorPage = (payload: {
  readonly finalError: RPCError
  readonly fromDeviceAdd: boolean
}) => ({payload, type: showFinalErrorPage as typeof showFinalErrorPage})
export const createShowGPGPage = (payload?: undefined) => ({payload, type: showGPGPage as typeof showGPGPage})
export const createShowInlineError = (payload: {readonly inlineError: RPCError}) => ({
  payload,
  type: showInlineError as typeof showInlineError,
})
export const createShowPaperkeyPage = (payload: {readonly error: HiddenString | null}) => ({
  payload,
  type: showPaperkeyPage as typeof showPaperkeyPage,
})
export const createShowPasswordPage = (payload: {readonly error: HiddenString | null}) => ({
  payload,
  type: showPasswordPage as typeof showPasswordPage,
})
export const createStartProvision = (
  payload: {readonly fromReset?: boolean; readonly initUsername?: string} = {}
) => ({payload, type: startProvision as typeof startProvision})
export const createSubmitDeviceName = (payload: {readonly name: string}) => ({
  payload,
  type: submitDeviceName as typeof submitDeviceName,
})
export const createSubmitDeviceSelect = (payload: {readonly name: string}) => ({
  payload,
  type: submitDeviceSelect as typeof submitDeviceSelect,
})
export const createSubmitGPGMethod = (payload: {readonly exportKey: boolean}) => ({
  payload,
  type: submitGPGMethod as typeof submitGPGMethod,
})
export const createSubmitGPGSignOK = (payload: {readonly accepted: boolean}) => ({
  payload,
  type: submitGPGSignOK as typeof submitGPGSignOK,
})
export const createSubmitPaperkey = (payload: {readonly paperkey: HiddenString}) => ({
  payload,
  type: submitPaperkey as typeof submitPaperkey,
})
export const createSubmitPassword = (payload: {readonly password: HiddenString}) => ({
  payload,
  type: submitPassword as typeof submitPassword,
})
export const createSubmitTextCode = (payload: {readonly phrase: HiddenString}) => ({
  payload,
  type: submitTextCode as typeof submitTextCode,
})
export const createSubmitUsername = (payload: {readonly username: string}) => ({
  payload,
  type: submitUsername as typeof submitUsername,
})
export const createSwitchToGPGSignOnly = (payload: {readonly importError: string}) => ({
  payload,
  type: switchToGPGSignOnly as typeof switchToGPGSignOnly,
})

// Action Payloads
export type AddNewDevicePayload = ReturnType<typeof createAddNewDevice>
export type BackToDeviceListPayload = ReturnType<typeof createBackToDeviceList>
export type CancelProvisionPayload = ReturnType<typeof createCancelProvision>
export type ForgotUsernamePayload = ReturnType<typeof createForgotUsername>
export type ForgotUsernameResultPayload = ReturnType<typeof createForgotUsernameResult>
export type ProvisionDonePayload = ReturnType<typeof createProvisionDone>
export type ProvisionErrorPayload = ReturnType<typeof createProvisionError>
export type ShowCodePagePayload = ReturnType<typeof createShowCodePage>
export type ShowDeviceListPagePayload = ReturnType<typeof createShowDeviceListPage>
export type ShowFinalErrorPagePayload = ReturnType<typeof createShowFinalErrorPage>
export type ShowGPGPagePayload = ReturnType<typeof createShowGPGPage>
export type ShowInlineErrorPayload = ReturnType<typeof createShowInlineError>
export type ShowNewDeviceNamePagePayload = ReturnType<typeof createShowNewDeviceNamePage>
export type ShowPaperkeyPagePayload = ReturnType<typeof createShowPaperkeyPage>
export type ShowPasswordPagePayload = ReturnType<typeof createShowPasswordPage>
export type StartProvisionPayload = ReturnType<typeof createStartProvision>
export type SubmitDeviceNamePayload = ReturnType<typeof createSubmitDeviceName>
export type SubmitDeviceSelectPayload = ReturnType<typeof createSubmitDeviceSelect>
export type SubmitGPGMethodPayload = ReturnType<typeof createSubmitGPGMethod>
export type SubmitGPGSignOKPayload = ReturnType<typeof createSubmitGPGSignOK>
export type SubmitPaperkeyPayload = ReturnType<typeof createSubmitPaperkey>
export type SubmitPasswordPayload = ReturnType<typeof createSubmitPassword>
export type SubmitTextCodePayload = ReturnType<typeof createSubmitTextCode>
export type SubmitUsernamePayload = ReturnType<typeof createSubmitUsername>
export type SwitchToGPGSignOnlyPayload = ReturnType<typeof createSwitchToGPGSignOnly>

// All Actions
// prettier-ignore
export type Actions =
  | AddNewDevicePayload
  | BackToDeviceListPayload
  | CancelProvisionPayload
  | ForgotUsernamePayload
  | ForgotUsernameResultPayload
  | ProvisionDonePayload
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
  | {readonly type: 'common:resetStore', readonly payload: undefined}
