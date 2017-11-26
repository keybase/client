// @flow
import HiddenString from '../../util/hidden-string'

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
