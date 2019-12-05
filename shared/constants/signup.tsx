import * as Types from './types/signup'
import * as Platforms from '../constants/platform'
import HiddenString from '../util/hidden-string'

export const maxUsernameLength = 16
export const usernameHint =
  'Usernames must be 2-16 characters, and can only contain letters, numbers, and underscores.'
export const noEmail = 'NOEMAIL'
export const waitingKey = 'signup:waiting'

const defaultDevicename =
  (Platforms.isAndroid && 'My Android Device') ||
  (Platforms.isIOS && 'My iOS Device') ||
  (Platforms.isDarwin && 'My Mac Device') ||
  (Platforms.isWindows && 'My Windows Device') ||
  (Platforms.isLinux && 'My Linux Device') ||
  (Platforms.isMobile ? 'Mobile Device' : 'Home Computer')

export const makeState = (): Types.State => ({
  devicename: defaultDevicename,
  devicenameError: '',
  email: '',
  emailError: '',
  emailVisible: false,
  inviteCode: '',
  inviteCodeError: '',
  justSignedUpEmail: '',
  name: '',
  nameError: '',
  password: new HiddenString(''),
  passwordError: new HiddenString(''),
  username: '',
  usernameError: '',
  usernameTaken: '',
})
