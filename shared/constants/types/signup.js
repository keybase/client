// @flow
import HiddenString from '../../util/hidden-string'

// TODO immutable
export type AutoInviteRequestState = 'NotRequested' | 'Requested' | 'Done'

export type State = {
  deviceName: ?string,
  deviceNameError: ?string,
  email: string,
  emailError: string,
  inviteCode: ?string,
  inviteCodeError: ?string,
  nameError: string,
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
  username: string,
  usernameError: string,
  waiting: boolean,
}
