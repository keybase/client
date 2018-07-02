// @flow
/* eslint-env jest */
import * as Constants from '../../constants/signup'
import * as SignupGen from '../signup-gen'
import * as LoginGen from '../login-gen'
import * as Saga from '../../util/saga'
import type {TypedState} from '../../constants/reducer'
import {loginTab} from '../../constants/tabs'
import HiddenString from '../../util/hidden-string'
import {navigateUp, navigateTo, navigateAppend} from '../route-tree'
import {_testing} from '../signup'
import reducer from '../../reducers/signup'

jest.unmock('immutable')

describe('resetNav works', () => {
  it('nab based on login', () => {
    expect(_testing.resetNav()).toEqual(Saga.put(LoginGen.createNavBasedOnLoginAndInitialState()))
  })
})

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

describe('requestInvite', () => {
  it('ignores if theres an error', () => {
    const getState = () => ({signup: Constants.makeState({devicenameError: 'has an error'})})
    const action = SignupGen.createRequestInvite({email: 'email@email.com', name: 'name'})
    const nextState: TypedState = ({signup: reducer(getState().signup, action)}: any)
    expect(_testing.showInviteSuccessOnNoErrors(nextState)).toEqual(false)
  })

  const getState = () => ({signup: Constants.makeState({})})
  it('saves email/name in store, shows invite success', () => {
    const action = SignupGen.createRequestInvite({email: 'email@email.com', name: 'name'})
    const nextState: TypedState = ({signup: reducer(getState().signup, action)}: any)
    expect(nextState.signup.email).toEqual(action.payload.email)
    expect(nextState.signup.name).toEqual(action.payload.name)
    expect(_testing.showInviteSuccessOnNoErrors(nextState)).toEqual(
      navigateAppend(['requestInviteSuccess'], [loginTab, 'signup'])
    )
  })

  it('shows error if it matches', () => {
    const preAction = SignupGen.createRequestInvite({email: 'email@email.com', name: 'name'})
    const preNextState: TypedState = ({signup: reducer(getState().signup, preAction)}: any)
    const action = SignupGen.createRequestedInviteError({
      email: preNextState.signup.email,
      emailError: 'email error',
      name: preNextState.signup.name,
      nameError: 'name error',
    })
    const nextState: TypedState = ({signup: reducer(preNextState.signup, action)}: any)
    expect(nextState.signup.emailError).toEqual(action.payload.emailError)
    expect(nextState.signup.nameError).toEqual(action.payload.nameError)
  })

  it("ignore error if it doesn't match", () => {
    const preAction = SignupGen.createRequestInvite({email: 'email@email.com', name: 'name'})
    const preNextState: TypedState = ({signup: reducer(getState().signup, preAction)}: any)
    const action = SignupGen.createRequestedInviteError({
      email: 'different email',
      emailError: 'email error',
      name: preNextState.signup.name,
      nameError: 'name error',
    })
    const nextState: TypedState = ({signup: reducer(preNextState.signup, action)}: any)
    expect(nextState).toEqual(preNextState)
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

describe('checkPassphrase', () => {
  it('passes must equal', () => {
    const getState = (): TypedState => ({signup: Constants.makeState({})}: any)
    const action = SignupGen.createCheckPassphrase({
      pass1: new HiddenString('aaaaaaaaaaa'),
      pass2: new HiddenString('bbbbbbbbbb'),
    })
    const nextState: TypedState = ({signup: reducer(getState().signup, action)}: any)
    expect(nextState.signup.passphraseError.stringValue()).toEqual('Passphrases must match')
  })
  it('passes must be long enough', () => {
    const getState = (): TypedState => ({signup: Constants.makeState({})}: any)
    const action = SignupGen.createCheckPassphrase({
      pass1: new HiddenString('12345'),
      pass2: new HiddenString('12345'),
    })
    const nextState: TypedState = ({signup: reducer(getState().signup, action)}: any)
    expect(nextState.signup.passphraseError.stringValue()).toEqual(
      'Passphrase must be at least 6 characters long'
    )
  })
  it('passes must have values', () => {
    const getState = (): TypedState => ({signup: Constants.makeState({})}: any)
    const action = SignupGen.createCheckPassphrase({pass1: new HiddenString(''), pass2: new HiddenString('')})
    const nextState: TypedState = ({signup: reducer(getState().signup, action)}: any)
    expect(nextState.signup.passphraseError.stringValue()).toEqual('Fields cannot be blank')
  })
  it('passes get updated', () => {
    const getState = (): TypedState => ({signup: Constants.makeState({})}: any)
    const action = SignupGen.createCheckPassphrase({
      pass1: new HiddenString('123456abcd'),
      pass2: new HiddenString('123456abcd'),
    })
    const nextState: TypedState = ({signup: reducer(getState().signup, action)}: any)
    expect(nextState.signup.passphraseError.stringValue()).toEqual('')
    expect(nextState.signup.passphrase.stringValue()).toEqual(action.payload.pass1.stringValue())
    expect(nextState.signup.passphrase.stringValue()).toEqual(action.payload.pass2.stringValue())
  })
})

describe('deviceScreen', () => {
  it('trims name', () => {
    const getState = (): TypedState => ({signup: Constants.makeState()}: any)
    const action = SignupGen.createCheckDevicename({devicename: '   a name  \n'})
    const nextState: TypedState = ({signup: reducer(getState().signup, action)}: any)
    expect(nextState.signup.devicename).toEqual('a name')
  })

  it("ignores if devicename doesn't match", () => {
    const getState = (): TypedState => ({signup: Constants.makeState({devicename: 'a device'})}: any)
    const action = SignupGen.createCheckedDevicenameError({devicename: 'different name', error: 'an error'})
    const nextState: TypedState = ({signup: reducer(getState().signup, action)}: any)
    // doesn't update
    expect(nextState).toEqual(getState())
  })

  it('shows error', () => {
    const getState = (): TypedState => ({signup: Constants.makeState({devicename: 'devicename'})}: any)
    const action = SignupGen.createCheckedDevicenameError({devicename: 'devicename', error: 'an error'})
    const nextState: TypedState = ({signup: reducer(getState().signup, action)}: any)
    expect(nextState.signup.devicename).toEqual(action.payload.devicename)
    expect(nextState.signup.devicenameError).toEqual(action.payload.error)
  })
})

describe('actually sign up', () => {
  it('bails on devicenameError', () => {
    const getState = (): TypedState => ({signup: Constants.makeState({devicenameError: 'error'})}: any)
    expect(_testing.reallySignupOnNoErrors(getState())).toBeUndefined()
  })
  it('bails on emailError', () => {
    const getState = (): TypedState => ({signup: Constants.makeState({emailError: 'error'})}: any)
    expect(_testing.reallySignupOnNoErrors(getState())).toBeUndefined()
  })
  it('bails on inviteCodeError', () => {
    const getState = (): TypedState => ({signup: Constants.makeState({inviteCodeError: 'error'})}: any)
    expect(_testing.reallySignupOnNoErrors(getState())).toBeUndefined()
  })
  it('bails on nameError', () => {
    const getState = (): TypedState => ({signup: Constants.makeState({nameError: 'error'})}: any)
    expect(_testing.reallySignupOnNoErrors(getState())).toBeUndefined()
  })
  it('bails on usernameError', () => {
    const getState = (): TypedState => ({signup: Constants.makeState({usernameError: 'error'})}: any)
    expect(_testing.reallySignupOnNoErrors(getState())).toBeUndefined()
  })
  it('bails on passphraseError', () => {
    const getState = (): TypedState =>
      ({signup: Constants.makeState({passphraseError: new HiddenString('error')})}: any)
    expect(_testing.reallySignupOnNoErrors(getState())).toBeUndefined()
  })
  it('bails on signupError', () => {
    const getState = (): TypedState =>
      ({signup: Constants.makeState({signupError: new HiddenString('error')})}: any)
    expect(_testing.reallySignupOnNoErrors(getState())).toBeUndefined()
  })

  const validSignup = Constants.makeState({
    devicename: 'a valid devicename',
    email: 'test@test.com',
    inviteCode: '1234566',
    passphrase: new HiddenString('a good passphrase'),
    username: 'testuser',
  })

  it('bails on missing email', () => {
    expect(() => _testing.reallySignupOnNoErrors(({signup: validSignup.set('email', '')}: any))).toThrow()
  })
  it('bails on missing devicename', () => {
    expect(() =>
      _testing.reallySignupOnNoErrors(({signup: validSignup.set('devicename', '')}: any))
    ).toThrow()
  })
  it('bails on missing inviteCode', () => {
    expect(() =>
      _testing.reallySignupOnNoErrors(({signup: validSignup.set('inviteCode', '')}: any))
    ).toThrow()
  })
  it('bails on missing passphrase', () => {
    expect(() =>
      _testing.reallySignupOnNoErrors(({signup: validSignup.set('passphrase', new HiddenString(''))}: any))
    ).toThrow()
  })
  it('bails on missing username', () => {
    expect(() => _testing.reallySignupOnNoErrors(({signup: validSignup.set('username', '')}: any))).toThrow()
  })

  it('updates error', () => {
    const getState = (): TypedState => ({signup: Constants.makeState({})}: any)
    const action = SignupGen.createSignedupError({error: new HiddenString('an error')})
    const nextState: TypedState = ({signup: reducer(getState().signup, action)}: any)
    expect(nextState.signup.signupError.stringValue()).toEqual(action.payload.error.stringValue())
    expect(_testing.showErrorOrCleanupAfterSignup(nextState)).toEqual(
      Saga.put(navigateAppend(['signupError'], [loginTab, 'signup']))
    )
  })

  it('after signup cleanup', () => {
    const getState = (): TypedState => ({signup: Constants.makeState({})}: any)
    const action = SignupGen.createSignedup()
    const nextState: TypedState = ({signup: reducer(getState().signup, action)}: any)
    expect(_testing.showErrorOrCleanupAfterSignup(nextState)).toEqual(
      Saga.put(SignupGen.createRestartSignup())
    )
  })
})
