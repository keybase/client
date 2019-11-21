import HiddenString from '../../util/hidden-string'
import {RPCError} from '../../util/errors'

export type AutoInviteRequestState = 'NotRequested' | 'Requested' | 'Done'

export type State = Readonly<{
  devicename: string
  devicenameError: string
  email: string
  emailError: string
  emailVisible: boolean
  inviteCode: string
  inviteCodeError: string
  justSignedUpEmail: string
  name: string
  nameError: string
  password: HiddenString
  passwordError: HiddenString
  signupError?: RPCError
  username: string
  usernameError: string
  usernameTaken: string
}>
