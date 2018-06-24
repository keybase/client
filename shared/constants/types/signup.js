// @flow
import * as I from 'immutable'
import HiddenString from '../../util/hidden-string'

export type AutoInviteRequestState = 'NotRequested' | 'Requested' | 'Done'

export type _State = {
  devicename: string,
  devicenameError: string,
  email: string,
  emailError: string,
  inviteCode: string,
  inviteCodeError: string,
  nameError: string,
  passphrase: ?HiddenString,
  passphraseError: ?HiddenString,
  signupError: ?HiddenString,
  username: string,
  usernameError: string,
}

export type State = I.RecordOf<_State>
