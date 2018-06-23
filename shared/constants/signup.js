// @flow
import type {State} from './types/signup'
import {isMobile} from '../constants/platform'

const initialState: State = {
  deviceName: isMobile ? 'Mobile Device' : 'Home Computer',
  deviceNameError: '',
  email: '',
  emailError: '',
  inviteCode: null,
  inviteCodeError: null,
  nameError: '',
  paperkey: null,
  passphrase: null,
  passphraseError: null,
  phase: 'inviteCode',
  signupError: null,
  username: '',
  usernameError: '',
  waiting: false,
}

export {initialState}
