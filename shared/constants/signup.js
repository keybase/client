// @flow
import type {State} from './types/signup'
import {isMobile} from '../constants/platform'

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
