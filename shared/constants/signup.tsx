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

export const makeState = I.Record<Types._State>({
  devicename,
  devicenameError: '',
  email: '',
  emailError: '',
  inviteCode: '',
  inviteCodeError: '',
  name: '',
  nameError: '',
  password: new HiddenString(''),
  passwordError: new HiddenString(''),
  signupError: new HiddenString(''),
  username: '',
  usernameError: '',
  usernameTaken: '',
})

export const waitingKey = 'signup:waiting'
