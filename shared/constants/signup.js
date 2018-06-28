// @flow
import * as I from 'immutable'
import * as Types from './types/signup'
import {isAndroid, isIOS, isDarwin, isWindows, isLinux, isMobile} from '../constants/platform'
import HiddenString from '../util/hidden-string'

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
  name: '',
  nameError: '',
  paperkey: new HiddenString(''),
  passphrase: new HiddenString(''),
  passphraseError: new HiddenString(''),
  signupError: new HiddenString(''),
  username: '',
  usernameError: '',
})

export const waitingKey = 'signup:waiting'
