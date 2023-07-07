import type * as Types from '../constants/types/signup'
import * as SignupGen from '../actions/signup-gen'
import HiddenString from '../util/hidden-string'
import trim from 'lodash/trim'
import * as Container from '../util/container'
import * as Constants from '../constants/signup'

const initialState = Constants.makeState()

type Actions = SignupGen.Actions

export default Container.makeReducer<Actions, Types.State>(initialState, {
  [SignupGen.resetStore]: () => ({
    ...initialState,
  }),
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
})
