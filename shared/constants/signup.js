// @flow
import * as I from 'immutable'
import * as Types from './types/signup'
import {isMobile} from '../constants/platform'

export const makeState: I.RecordFactory<Types._State> = I.Record({
  deviceName: isMobile ? 'Mobile Device' : 'Home Computer',
  deviceNameError: '',
  email: '',
  emailError: '',
  inviteCode: '',
  inviteCodeError: '',
  nameError: '',
  paperkey: null,
  passphrase: null,
  passphraseError: null,
  signupError: null,
  username: '',
  usernameError: '',
})

export const waitingKey = 'signup:waiting'
