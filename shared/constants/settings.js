// @flow
import * as Types from './types/settings'
import HiddenString from '../util/hidden-string'
import type {TypedState} from './reducer'

const initialState: Types.State = {
  allowDeleteAccount: false,
  email: {
    emails: [],
    error: null,
    newEmail: '',
  },
  invites: {
    acceptedInvites: [],
    error: null,
    pendingInvites: [],
  },
  notifications: {
    allowEdit: false,
    groups: {
      email: {
        settings: null,
        unsubscribedFromAll: false,
      },
    },
  },
  passphrase: {
    error: null,
    hasPGPKeyOnServer: null,
    newPassphrase: new HiddenString(''),
    newPassphraseConfirm: new HiddenString(''),
    newPassphraseConfirmError: null,
    newPassphraseError: null,
    rememberPassphrase: true,
  },
  push: {
    permissionsPrompt: false,
    permissionsRequesting: false,
    token: '',
    tokenType: '',
  },
  waitingForResponse: false,
}

const traceInProgressKey = 'traceInProgress'

const traceInProgress = (state: TypedState) => state.waiting.get(traceInProgressKey, 0) !== 0

export const aboutTab = 'settingsTabs:aboutTab'
export const advancedTab = 'settingsTabs:advancedTab'
export const deleteMeTab = 'settingsTabs:deleteMeTab'
export const devMenuTab = 'settingsTabs:devMenuTab'
export const devicesTab = 'settingsTabs:devicesTab'
export const feedbackTab = 'settingsTabs:feedbackTab'
export const foldersTab = 'settingsTabs:foldersTab'
export const fsTab = 'settingsTabs:fsTab'
export const gitTab = 'settingsTabs:gitTab'
export const invitationsTab = 'settingsTabs:invitationsTab'
export const landingTab = 'settingsTabs:landingTab'
export const notificationsTab = 'settingsTabs:notificationsTab'
export const passphraseTab = 'settingsTabs:passphrase'
export const screenprotectorTab = 'settingsTabs:screenprotector'
export const updatePaymentTab = 'settingsTabs:updatePaymentTab'
export const securityGroup = 'security'
export {initialState, traceInProgressKey, traceInProgress}
