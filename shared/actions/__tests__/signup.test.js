// @flow
/* eslint-env jest */
import * as Constants from '../../constants/signup'
import * as SignupGen from '../signup-gen'
import * as Saga from '../../util/saga'
import type {TypedState} from '../../constants/reducer'
import {loginTab} from '../../constants/tabs'
import HiddenString from '../../util/hidden-string'
import {navigateUp, navigateTo, navigateAppend} from '../route-tree'
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
    const nextState = {signup: reducer(getState().signup, action)}
    expect(nextState.signup.inviteCode).toEqual(action.payload.inviteCode)
    expect(_testing.showInviteScreen()).toEqual(navigateTo([loginTab, 'signup', 'inviteCode']))
  })

  it('goes to invite page on error', () => {
    const action = SignupGen.createRequestedAutoInviteError()
    const nextState = {signup: reducer(getState().signup, action)}
    expect(nextState).toEqual(getState())
    expect(_testing.showInviteScreen()).toEqual(navigateTo([loginTab, 'signup', 'inviteCode']))
  })
})

describe('checkInviteCode', () => {
  const getState = () => ({signup: Constants.makeState({})})
  it('checks requestedAutoInvite', () => {
    const action = SignupGen.createRequestedAutoInvite({inviteCode: 'invite code'})
    const nextState = {signup: reducer(getState().signup, action)}
    expect(nextState.signup.inviteCode).toEqual(action.payload.inviteCode)
  })
  it('checks checkInviteCode', () => {
    const action = SignupGen.createCheckInviteCode({inviteCode: 'invite code'})
    const nextState = {signup: reducer(getState().signup, action)}
    expect(nextState.signup.inviteCode).toEqual(action.payload.inviteCode)
  })
  it('shows user email page on success', () => {
    const action = SignupGen.createCheckedInviteCode({inviteCode: 'working'})
    const nextState: TypedState = ({signup: reducer(getState().signup, action)}: any)
    // leaves state alone
    expect(nextState).toEqual(getState())
    expect(_testing.showUserEmailOnNoErrors(nextState)).toEqual(
      Saga.put(navigateTo([loginTab, 'signup', 'usernameAndEmail']))
    )
  })
  it("shows error on fail: must match invite code. doesn't go to next screen", () => {
    const preAction = SignupGen.createRequestedAutoInvite({inviteCode: 'invite code'})
    const preState: TypedState = ({signup: reducer(getState().signup, preAction)}: any)
    const action = SignupGen.createCheckedInviteCodeError({
      error: 'bad invitecode',
      inviteCode: 'invite code',
    })

    const nextState: TypedState = ({signup: reducer(preState.signup, action)}: any)
    expect(nextState.signup.inviteCodeError).toEqual(action.payload.error)
    expect(_testing.showUserEmailOnNoErrors(nextState)).toEqual(false)
  })
  it("ignores error if invite doesn't match", () => {
    const preAction = SignupGen.createRequestedAutoInvite({inviteCode: 'a different invite code'})
    const preState: TypedState = ({signup: reducer(getState().signup, preAction)}: any)
    const action = SignupGen.createCheckedInviteCodeError({
      error: 'bad invitecode',
      inviteCode: 'invite code',
    })

    const nextState: TypedState = ({signup: reducer(preState.signup, action)}: any)
    expect(nextState).toEqual(preState)
  })
})

describe('checkUsernameEmail', () => {
  it("ignores if there's an error", () => {
    const getState = (): TypedState => ({signup: Constants.makeState({inviteCodeError: 'invite error'})}: any)
    expect(_testing.checkUsernameEmail(getState())).toEqual(false)
  })

  it('Updates store on success', () => {
    const getState = () => ({signup: Constants.makeState({})})
    const action = SignupGen.createCheckUsernameEmail({email: 'email@email.com', username: 'username'})
    const nextState: TypedState = ({signup: reducer(getState().signup, action)}: any)
    expect(nextState.signup.email).toEqual(action.payload.email)
    expect(nextState.signup.username).toEqual(action.payload.username)
  })

  it('Locally checks simple problems', () => {
    const getState = () => ({signup: Constants.makeState({})})
    const action = SignupGen.createCheckUsernameEmail({email: 'notAValidEmail', username: 'a.bad.username'})
    const nextState: TypedState = ({signup: reducer(getState().signup, action)}: any)
    expect(nextState.signup.emailError).toBeTruthy()
    expect(nextState.signup.usernameError).toBeTruthy()
    expect(nextState.signup.email).toEqual(action.payload.email)
    expect(nextState.signup.username).toEqual(action.payload.username)
  })
})

describe('checkedUsernameEmail', () => {
  it("ignores if email doesn't match", () => {
    const getState = (): TypedState =>
      ({signup: Constants.makeState({email: 'email@email.com', username: 'username'})}: any)
    const action = SignupGen.createCheckedUsernameEmailError({
      email: 'different@email.com',
      emailError: 'a problem',
      username: getState().signup.username,
      usernameError: 'another problem',
    })
    const nextState: TypedState = ({signup: reducer(getState().signup, action)}: any)
    // doesn't update
    expect(nextState).toEqual(getState())
  })

  it("ignores if username doesn't match", () => {
    const getState = (): TypedState =>
      ({signup: Constants.makeState({email: 'email@email.com', username: 'username'})}: any)
    const action = SignupGen.createCheckedUsernameEmailError({
      email: getState().signup.email,
      emailError: 'a problem',
      username: 'different username',
      usernameError: 'another problem',
    })
    const nextState: TypedState = ({signup: reducer(getState().signup, action)}: any)
    // doesn't update
    expect(nextState).toEqual(getState())
  })

  it('shows error', () => {
    const getState = (): TypedState =>
      ({signup: Constants.makeState({email: 'email@email.com', username: 'username'})}: any)
    const action = SignupGen.createCheckedUsernameEmailError({
      email: getState().signup.email,
      emailError: 'a problem',
      username: getState().signup.username,
      usernameError: 'another problem',
    })
    const nextState: TypedState = ({signup: reducer(getState().signup, action)}: any)
    expect(nextState.signup.emailError).toEqual(action.payload.emailError)
    expect(nextState.signup.usernameError).toEqual(action.payload.usernameError)
  })

  it('shows passphrase page on success', () => {
    const getState = (): TypedState =>
      ({signup: Constants.makeState({email: 'email@email.com', username: 'username'})}: any)
    const action = SignupGen.createCheckedUsernameEmail({
      email: getState().signup.email,
      username: getState().signup.username,
    })
    const nextState: TypedState = ({signup: reducer(getState().signup, action)}: any)
    // doesn't update
    expect(_testing.showPassphraseOnNoErrors(nextState)).toEqual(
      Saga.put(navigateAppend(['passphraseSignup'], [loginTab, 'signup']))
    )
  })
})
