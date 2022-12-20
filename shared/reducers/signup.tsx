import type * as Types from '../constants/types/signup'
import * as SignupGen from '../actions/signup-gen'
import * as SettingsGen from '../actions/settings-gen'
import HiddenString from '../util/hidden-string'
import trim from 'lodash/trim'
import {isValidEmail, isValidName, isValidUsername} from '../util/simple-validators'
import * as Container from '../util/container'
import * as Constants from '../constants/signup'

const initialState = Constants.makeState()

type Actions = SignupGen.Actions | SettingsGen.EmailVerifiedPayload

export default Container.makeReducer<Actions, Types.State>(initialState, {
  [SignupGen.resetStore]: draftState => ({
    ...initialState,
    justSignedUpEmail: draftState.email,
  }),
  [SignupGen.restartSignup]: draftState => ({
    ...initialState,
    justSignedUpEmail: draftState.email,
  }),
  [SignupGen.goBackAndClearErrors]: draftState => {
    draftState.devicenameError = ''
    draftState.emailError = ''
    draftState.inviteCodeError = ''
    draftState.nameError = ''
    draftState.passwordError = new HiddenString('')
    draftState.signupError = undefined
    draftState.usernameError = ''
    draftState.usernameTaken = ''
  },
  [SignupGen.requestAutoInvite]: (draftState, action) => {
    if (action.payload.username) {
      draftState.username = action.payload.username
    }
  },
  [SignupGen.requestedAutoInvite]: (draftState, action) => {
    draftState.inviteCode = action.payload.error ? '' : action.payload.inviteCode ?? ''
  },
  [SignupGen.checkInviteCode]: (draftState, action) => {
    draftState.inviteCode = action.payload.inviteCode
  },
  [SignupGen.checkedInviteCode]: (draftState, action) => {
    if (action.payload.inviteCode === draftState.inviteCode) {
      draftState.inviteCodeError = action.payload.error ? action.payload.error : ''
    }
  },
  [SignupGen.checkUsername]: (draftState, action) => {
    const {username} = action.payload
    draftState.username = username
    draftState.usernameError = isValidUsername(username)
    draftState.usernameTaken = ''
  },
  [SignupGen.checkedUsername]: (draftState, action) => {
    const {username, usernameTaken = '', error: usernameError} = action.payload
    if (username === draftState.username) {
      draftState.usernameError = usernameError
      draftState.usernameTaken = usernameTaken
    }
  },
  [SignupGen.requestInvite]: (draftState, action) => {
    const {email, name} = action.payload
    draftState.email = email
    draftState.emailError = isValidEmail(email)
    draftState.name = name
    draftState.nameError = isValidName(name)
  },
  [SignupGen.requestedInvite]: (draftState, action) => {
    if (action.payload.email === draftState.email && action.payload.name === draftState.name) {
      draftState.emailError = action.payload.emailError || ''
      draftState.nameError = action.payload.nameError || ''
    }
  },
  [SignupGen.checkPassword]: (draftState, action) => {
    const {pass1, pass2} = action.payload
    const p1 = pass1.stringValue()
    const p2 = pass2.stringValue()
    let passwordError = new HiddenString('')
    if (!p1 || !p2) {
      passwordError = new HiddenString('Fields cannot be blank')
    } else if (p1 !== p2) {
      passwordError = new HiddenString('Passwords must match')
    } else if (p1.length < 8) {
      passwordError = new HiddenString('Password must be at least 8 characters long')
    }
    draftState.password = pass1
    draftState.passwordError = passwordError
  },
  [SignupGen.checkDevicename]: (draftState, action) => {
    const devicename = trim(action.payload.devicename)
    draftState.devicename = devicename
    draftState.devicenameError = devicename.length === 0 ? 'Device name must not be empty.' : ''
  },
  [SignupGen.checkedDevicename]: (draftState, action) => {
    if (action.payload.devicename === draftState.devicename) {
      draftState.devicenameError = action.payload.error ?? ''
    }
  },
  [SignupGen.signedup]: (draftState, action) => {
    draftState.signupError = action.payload.error
  },
  [SignupGen.setJustSignedUpEmail]: (draftState, action) => {
    draftState.justSignedUpEmail = action.payload.email
  },
  [SignupGen.clearJustSignedUpEmail]: draftState => {
    draftState.justSignedUpEmail = ''
  },
  [SettingsGen.emailVerified]: draftState => {
    draftState.justSignedUpEmail = ''
  },
})
