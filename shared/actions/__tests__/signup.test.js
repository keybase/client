// @flow
/* eslint-env jest */
import * as Constants from '../../constants/signup'
import * as SignupGen from '../signup-gen'
import * as Saga from '../../util/saga'
import type {TypedState} from '../../constants/reducer'
import {loginTab} from '../../constants/tabs'
import HiddenString from '../../util/hidden-string'
import {navigateUp, navigateTo} from '../route-tree'
import {_testing} from '../signup'
import reducer from '../../reducers/signup'

jest.unmock('immutable')

describe('goBackAndClearErrors', () => {
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
    const nextState = {signup: reducer(getState().signup, action)}
    expect(nextState.signup.devicenameError).toEqual('')
    expect(nextState.signup.emailError).toEqual('')
    expect(nextState.signup.inviteCodeError).toEqual('')
    expect(nextState.signup.nameError).toEqual('')
    expect(nextState.signup.passphraseError.stringValue()).toEqual('')
    expect(nextState.signup.signupError.stringValue()).toEqual('')
    expect(nextState.signup.usernameError).toEqual('')
    expect(_testing.goBackAndClearErrors()).toEqual(Saga.put(navigateUp()))
  })
})

describe('requestAutoInvite', () => {
  const getState = () => ({signup: Constants.makeState({})})
  it('makes a call to get an auto invite', () => {
    const action = SignupGen.createRequestAutoInvite()
    const nextState = {signup: reducer(getState().signup, action)}
    expect(nextState).toEqual(getState())
  })

  it('fills inviteCode, shows invite screen', () => {
    const action = SignupGen.createRequestedAutoInvite({inviteCode: 'hello world'})
    const nextSignupState = reducer(getState().signup, action)
    const nextState = {signup: nextSignupState}
    expect(nextState.signup.inviteCode).toEqual(action.payload.inviteCode)
    expect(_testing.showInviteScreen()).toEqual(navigateTo([loginTab, 'signup', 'inviteCode']))
  })

  it('goes to invite page on error', () => {
    const action = SignupGen.createRequestedAutoInviteError()
    const nextSignupState = reducer(getState().signup, action)
    const nextState = {signup: nextSignupState}
    expect(nextState).toEqual(getState())
    expect(_testing.showInviteScreen()).toEqual(navigateTo([loginTab, 'signup', 'inviteCode']))
  })
})

describe('checkInviteCode', () => {
  const getState = () => ({signup: Constants.makeState({})})
  it('checks requestedAutoInvite', () => {
    const action = SignupGen.createRequestedAutoInvite({inviteCode: 'invite code'})
    const nextSignupState = reducer(getState().signup, action)
    const nextState = {signup: nextSignupState}
    expect(nextState.signup.inviteCode).toEqual(action.payload.inviteCode)
  })
  it('checks checkInviteCode', () => {
    const action = SignupGen.createCheckInviteCode({inviteCode: 'invite code'})
    const nextSignupState = reducer(getState().signup, action)
    const nextState = {signup: nextSignupState}
    expect(nextState.signup.inviteCode).toEqual(action.payload.inviteCode)
  })
  it('shows user email page on success', () => {
    const action = SignupGen.createCheckedInviteCode({inviteCode: 'working'})
    const nextSignupState = reducer(getState().signup, action)
    const nextState: TypedState = ({signup: nextSignupState}: any)
    // leaves state alone
    expect(nextState).toEqual(getState())
    expect(_testing.showUserEmailOnNoErrors(action, nextState)).toEqual(
      Saga.put(navigateTo([loginTab, 'signup', 'usernameAndEmail']))
    )
  })
  it("shows error on fail: must match invite code. doesn't go to next screen", () => {
    const preAction = SignupGen.createRequestedAutoInvite({inviteCode: 'invite code'})
    const preNextSignupState = reducer(getState().signup, preAction)
    const preState: TypedState = ({signup: preNextSignupState}: any)
    const action = SignupGen.createCheckedInviteCodeError({
      error: 'bad invitecode',
      inviteCode: 'invite code',
    })

    const nextSignupState = reducer(preState.signup, action)
    const nextState: TypedState = ({signup: nextSignupState}: any)
    expect(nextState.signup.inviteCodeError).toEqual(action.payload.error)
    expect(_testing.showUserEmailOnNoErrors(action, nextState)).toEqual(false)
  })
  it("ignores error if invite doesn't match", () => {
    const preAction = SignupGen.createRequestedAutoInvite({inviteCode: 'a different invite code'})
    const preNextSignupState = reducer(getState().signup, preAction)
    const preState: TypedState = ({signup: preNextSignupState}: any)
    const action = SignupGen.createCheckedInviteCodeError({
      error: 'bad invitecode',
      inviteCode: 'invite code',
    })

    const nextSignupState = reducer(preState.signup, action)
    const nextState: TypedState = ({signup: nextSignupState}: any)
    expect(nextState).toEqual(preState)
  })
})
