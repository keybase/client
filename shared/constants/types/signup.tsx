import type HiddenString from '../../util/hidden-string'
import type {RPCError} from '../../util/errors'

export type AutoInviteRequestState = 'NotRequested' | 'Requested' | 'Done'

export type State = {
  readonly devicename: string
  readonly devicenameError: string
  readonly email: string
  readonly emailError: string
  readonly emailVisible: boolean
  readonly inviteCode: string
  readonly inviteCodeError: string
  readonly justSignedUpEmail: string
  readonly name: string
  readonly nameError: string
  readonly password: HiddenString
  readonly passwordError: HiddenString
  readonly signupError?: RPCError
  readonly username: string
  readonly usernameError: string
  readonly usernameTaken: string
}
