import type HiddenString from '../../util/hidden-string'
import type {RPCError} from '../../util/errors'

export type AutoInviteRequestState = 'NotRequested' | 'Requested' | 'Done'

export type State = {
  devicename: string
  devicenameError: string
  inviteCode: string
  inviteCodeError: string
  justSignedUpEmail: string
  password: HiddenString
  passwordError: HiddenString
  signupError?: RPCError
  username: string
  usernameError: string
  usernameTaken: string
}
