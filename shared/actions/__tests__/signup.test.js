// @flow
/* eslint-env jest */
// import * as I from 'immutable'
// import * as Types from '../../constants/types/signup'
import * as Constants from '../../constants/signup'
import * as SignupGen from '../signup-gen'
import * as Saga from '../../util/saga'
// import * as WaitingGen from '../waiting-gen'
import HiddenString from '../../util/hidden-string'
import {navigateUp} from '../route-tree'
import {_testing} from '../signup'
import reducer from '../../reducers/signup'

jest.unmock('immutable')

describe('cleanup', () => {
  it('errors get cleaned and we go back a level', () => {
    const getState = () => ({
      signup: Constants.makeState({
        devicenameError: 'bad name',
        emailError: 'bad email',
        inviteCodeError: 'bad invite',
        nameError: 'bad name',
        passphraseError: new HiddenString('bad pass'),
        signupError: new HiddenString('bad signup'),
        usernameError: 'bad username',
      }),
    })

    const action = SignupGen.createGoBackAndClearErrors()
    const nextSignupState = reducer(getState().signup, action)
    const nextState = {signup: nextSignupState}
    expect(nextState.signup.devicenameError).toEqual('')
    expect(nextState.signup.emailError).toEqual('')
    expect(nextState.signup.inviteCodeError).toEqual('')
    expect(nextState.signup.nameError).toEqual('')
    expect(nextState.signup.passphraseError.stringValue()).toEqual('')
    expect(nextState.signup.signupError.stringValue()).toEqual('')
    expect(nextState.signup.usernameError).toEqual('')
    expect(_testing.goBackAndClearErrors(/* action, nextState */)).toEqual(Saga.put(navigateUp()))
  })
})
