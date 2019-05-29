import * as I from 'immutable'
import * as Types from './types/signup'
import {isAndroid, isIOS, isDarwin, isWindows, isLinux, isMobile} from '../constants/platform'
import HiddenString from '../util/hidden-string'

export const maxUsernameLength = 16

const devicename =
  (isAndroid && 'My Android Device') ||
  (isIOS && 'My iOS Device') ||
  (isDarwin && 'My Mac Device') ||
  (isWindows && 'My Windows Device') ||
  (isLinux && 'My Linux Device') ||
  (isMobile ? 'Mobile Device' : 'Home Computer')

export const makeState: I.Record.Factory<Types._State> = I.Record({
  devicename,
  devicenameError: '',
  email: '',
  emailError: '',
  inviteCode: '',
  inviteCodeError: '',
  name: '',
  nameError: '',
  paperkey: new HiddenString(''),
  password: new HiddenString(''),
  passwordError: new HiddenString(''),
  signupError: new HiddenString(''),
  username: '',
  usernameError: '',
})

export const waitingKey = 'signup:waiting'
