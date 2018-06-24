// @flow
import * as I from 'immutable'
import * as Types from './types/signup'
import {isAndroid, isIOS, isDarwin, isWindows, isLinux, isMobile} from '../constants/platform'

const devicename =
  (isAndroid && 'My Android Device') ||
  (isIOS && 'My iOS Device') ||
  (isDarwin && 'My Mac Device') ||
  (isWindows && 'My Windows Device') ||
  (isLinux && 'My Linux Device') ||
  (isMobile ? 'Mobile Device' : 'Home Computer')

export const makeState: I.RecordFactory<Types._State> = I.Record({
  devicename,
  devicenameError: '',
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
