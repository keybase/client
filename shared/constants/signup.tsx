import * as I from 'immutable'
import * as Types from './types/signup'
import {isAndroid, isIOS, isDarwin, isWindows, isLinux, isMobile} from '../constants/platform'
import HiddenString from '../util/hidden-string'
import {RPCError} from '../util/errors'

export const maxUsernameLength = 16
export const usernameHint =
  'Usernames must be 2-16 characters, and can only contain letters, numbers, and underscores.'

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
  signupError: null,
  username: '',
  usernameError: '',
  usernameTaken: '',
})

export const waitingKey = 'signup:waiting'
