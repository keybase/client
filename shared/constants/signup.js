// @flow
import HiddenString from '../util/hidden-string'
import {isMobile} from '../constants/platform'

export type AutoInviteRequestState = 'NotRequested' | 'Requested' | 'Done'

export type State = {
  deviceName: ?string,
  deviceNameError: ?string,
  email: ?string,
  emailError: ?Error,
  inviteCode: ?string,
  inviteCodeError: ?string,
  nameError: ?Error,
  paperkey: ?HiddenString,
  passphrase: ?HiddenString,
  passphraseError: ?HiddenString,
  phase:
    | 'inviteCode'
    | 'usernameAndEmail'
    | 'passphraseSignup'
    | 'deviceName'
    | 'signupLoading'
    | 'success'
    | 'signupError'
    | 'requestInvite'
    | 'requestInviteSuccess',
  signupError: ?HiddenString,
  username: ?string,
  usernameError: ?Error,
  waiting: boolean,
}

const initialState: State = {
  deviceName: isMobile ? 'Mobile Device' : 'Home Computer',
  deviceNameError: null,
  email: null,
  emailError: null,
  inviteCode: null,
  inviteCodeError: null,
  nameError: null,
  paperkey: null,
  passphrase: null,
  passphraseError: null,
  phase: 'inviteCode',
  signupError: null,
  username: null,
  usernameError: null,
  waiting: false,
}

export {initialState}
