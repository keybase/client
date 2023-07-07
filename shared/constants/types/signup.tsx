import type HiddenString from '../../util/hidden-string'
import type {RPCError} from '../../util/errors'

export type AutoInviteRequestState = 'NotRequested' | 'Requested' | 'Done'

export type State = {
  devicename: string
  devicenameError: string
  justSignedUpEmail: string
  password: HiddenString
  passwordError: HiddenString
  signupError?: RPCError
}
