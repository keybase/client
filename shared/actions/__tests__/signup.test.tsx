/* eslint-env jest */
import * as Types from '../../constants/types/signup'
import * as Constants from '../../constants/signup'
import * as SignupGen from '../signup-gen'
import {TypedState} from '../../constants/reducer'
import HiddenString from '../../util/hidden-string'
import {SagaLogger} from '../../util/saga'
import {RPCError} from '../../util/errors'
import * as RouteTreeGen from '../route-tree-gen'
import {_testing} from '../signup'
import reducer from '../../reducers/signup'

const testLogger = new SagaLogger('TESTING' as any, 'TESTINGFCN')

const makeTypedState = (signupState: Types.State): TypedState => ({signup: signupState} as any)

describe('goBackAndClearErrors', () => {
  it('errors get cleaned and we go back a level', () => {
    const state = {
      ...Constants.makeState(),
      devicenameError: 'bad name',
      emailError: 'bad email',
      inviteCodeError: 'bad invite',
      nameError: 'bad name',
      signupError: new RPCError('bad signup', 0),
      usernameError: 'bad username',
    }

    const action = SignupGen.createGoBackAndClearErrors()
    const nextState = {signup: reducer(state, action)}
    expect(nextState.signup.devicenameError).toEqual('')
    expect(nextState.signup.emailError).toEqual('')
    expect(nextState.signup.inviteCodeError).toEqual('')
    expect(nextState.signup.nameError).toEqual('')
    expect(nextState.signup.signupError).toEqual(undefined)
    expect(nextState.signup.usernameError).toEqual('')
    expect(_testing.goBackAndClearErrors()).toEqual(RouteTreeGen.createNavigateUp())
  })
})

describe('requestAutoInvite', () => {
  const state = Constants.makeState()
  it('makes a call to get an auto invite', () => {
    const action = SignupGen.createRequestAutoInvite()
    const nextState = makeTypedState(reducer(state, action))
    expect(nextState).toEqual(makeTypedState(state))
  })

  it('fills inviteCode, shows invite screen', () => {
    const action = SignupGen.createRequestedAutoInvite({inviteCode: 'hello world'})
    const nextState = makeTypedState(reducer(state, action))
    expect(nextState.signup.inviteCode).toEqual(action.payload.inviteCode)
    expect(_testing.showInviteScreen()).toEqual(
      RouteTreeGen.createNavigateAppend({path: ['signupInviteCode']})
    )
  })

  it('goes to invite page on error', () => {
    const action = SignupGen.createRequestedAutoInvite({})
    const nextState = makeTypedState(reducer(state, action))
    expect(nextState).toEqual(makeTypedState(state))
    expect(_testing.showInviteScreen()).toEqual(
      RouteTreeGen.createNavigateAppend({path: ['signupInviteCode']})
    )
  })
})

describe('requestInvite', () => {
  it('ignores if theres an error', () => {
    const state = {...Constants.makeState(), devicenameError: 'has an error'}
    const action = SignupGen.createRequestInvite({email: 'email@email.com', name: 'name'})
    const nextState = makeTypedState(reducer(state, action))
    expect(_testing.showInviteSuccessOnNoErrors(nextState)).toEqual(false)
  })

  const state = Constants.makeState()
  it('saves email/name in store, shows invite success', () => {
    const action = SignupGen.createRequestInvite({email: 'email@email.com', name: 'name'})
    const nextState = makeTypedState(reducer(state, action))
    expect(nextState.signup.email).toEqual(action.payload.email)
    expect(nextState.signup.name).toEqual(action.payload.name)
    expect(_testing.showInviteSuccessOnNoErrors(nextState)).toEqual(
      RouteTreeGen.createNavigateAppend({path: ['signupRequestInviteSuccess']})
    )
  })

  it('shows error if it matches', () => {
    const preAction = SignupGen.createRequestInvite({email: 'email@email.com', name: 'name'})
    const preNextState = makeTypedState(reducer(state, preAction))
    const action = SignupGen.createRequestedInvite({
      email: preNextState.signup.email,
      emailError: 'email error',
      name: preNextState.signup.name,
      nameError: 'name error',
    })
    const nextState = makeTypedState(reducer(preNextState.signup, action))
    expect(nextState.signup.emailError).toEqual(action.payload.emailError)
    expect(nextState.signup.nameError).toEqual(action.payload.nameError)
  })

  it("ignore error if it doesn't match", () => {
    const preAction = SignupGen.createRequestInvite({email: 'email@email.com', name: 'name'})
    const preNextState = makeTypedState(reducer(state, preAction))
    const action = SignupGen.createRequestedInvite({
      email: 'different email',
      emailError: 'email error',
      name: preNextState.signup.name,
      nameError: 'name error',
    })
    const nextState = makeTypedState(reducer(preNextState.signup, action))
    expect(nextState).toEqual(preNextState)
  })
})

describe('checkInviteCode', () => {
  const state = Constants.makeState()
  it('checks requestedAutoInvite', () => {
    const action = SignupGen.createRequestedAutoInvite({inviteCode: 'invite code'})
    const nextState = makeTypedState(reducer(state, action))
    expect(nextState.signup.inviteCode).toEqual(action.payload.inviteCode)
  })
  it('checks checkInviteCode', () => {
    const action = SignupGen.createCheckInviteCode({inviteCode: 'invite code'})
    const nextState = makeTypedState(reducer(state, action))
    expect(nextState.signup.inviteCode).toEqual(action.payload.inviteCode)
  })
  it('shows user email page on success', () => {
    const action = SignupGen.createCheckedInviteCode({inviteCode: 'working'})
    const nextState = makeTypedState(reducer(state, action))
    // leaves state alone
    expect(nextState).toEqual(makeTypedState(state))
    // expect(_testing.showUserOnNoErrors(nextState)).toEqual(
    // RouteTreeGen.createNavigateAppend({ path: ['signupUsernameAndEmail']})
    // )
  })
  it("shows error on fail: must match invite code. doesn't go to next screen", () => {
    const preAction = SignupGen.createRequestedAutoInvite({inviteCode: 'invite code'})
    const preState = makeTypedState(reducer(state, preAction))
    const action = SignupGen.createCheckedInviteCode({
      error: 'bad invitecode',
      inviteCode: 'invite code',
    })

    const nextState = makeTypedState(reducer(preState.signup, action))
    expect(nextState.signup.inviteCodeError).toEqual(action.payload.error)
    expect(_testing.showUserOnNoErrors(nextState)).toEqual(false)
  })
  it("ignores error if invite doesn't match", () => {
    const preAction = SignupGen.createRequestedAutoInvite({inviteCode: 'a different invite code'})
    const preState = makeTypedState(reducer(state, preAction))
    const action = SignupGen.createCheckedInviteCode({
      error: 'bad invitecode',
      inviteCode: 'invite code',
    })

    const nextState = makeTypedState(reducer(preState.signup, action))
    expect(nextState).toEqual(preState)
  })
})

describe('checkUsername', () => {
  it("ignores if there's an error", () => {
    const state = {...Constants.makeState(), inviteCodeError: 'invite error'}
    expect(_testing.checkUsername(makeTypedState(state), null as any, testLogger)).resolves.toEqual(false)
  })

  it('Updates store on success', () => {
    const state = Constants.makeState()
    const action = SignupGen.createCheckUsername({username: 'username'})
    const nextState = makeTypedState(reducer(state, action))
    expect(nextState.signup.username).toEqual(action.payload.username)
  })

  it('Locally checks simple problems', () => {
    const state = Constants.makeState()
    const action = SignupGen.createCheckUsername({username: 'a.bad.username'})
    const nextState = makeTypedState(reducer(state, action))
    expect(nextState.signup.usernameError).toBeTruthy()
    expect(nextState.signup.username).toEqual(action.payload.username)
  })
})

describe('checkedUsername', () => {
  it("ignores if username doesn't match", () => {
    const state = {...Constants.makeState(), username: 'username'}
    const action = SignupGen.createCheckedUsername({
      error: 'another problem',
      username: 'different username',
    })
    const nextState = makeTypedState(reducer(state, action))
    // doesn't update
    expect(nextState).toEqual(makeTypedState(state))
  })

  it('shows error', () => {
    const state = {...Constants.makeState(), username: 'username'}
    const action = SignupGen.createCheckedUsername({
      error: 'another problem',
      username: state.username,
    })
    const nextState = makeTypedState(reducer(state, action))
    expect(nextState.signup.usernameError).toEqual(action.payload.error)
  })

  it('shows device name page on success', () => {
    const state = {...Constants.makeState(), username: 'username'}
    const action = SignupGen.createCheckedUsername({
      error: '',
      username: state.username,
    })
    const nextState = makeTypedState(reducer(state, action))
    expect(_testing.showDeviceScreenOnNoErrors(nextState)).toEqual(
      RouteTreeGen.createNavigateAppend({path: ['signupEnterDevicename']})
    )
  })
})

describe('checkPassword', () => {
  it('passes must equal', () => {
    const state = Constants.makeState()
    const action = SignupGen.createCheckPassword({
      pass1: new HiddenString('aaaaaaaaaaa'),
      pass2: new HiddenString('bbbbbbbbbb'),
    })
    const nextState = makeTypedState(reducer(state, action))
    expect(nextState.signup.passwordError.stringValue()).toEqual('Passwords must match')
  })
  it('passes must be long enough', () => {
    const state = Constants.makeState()
    const action = SignupGen.createCheckPassword({
      pass1: new HiddenString('12345'),
      pass2: new HiddenString('12345'),
    })
    const nextState = makeTypedState(reducer(state, action))
    expect(nextState.signup.passwordError.stringValue()).toEqual(
      'Password must be at least 8 characters long'
    )
  })
  it('passes must have values', () => {
    const state = Constants.makeState()
    const action = SignupGen.createCheckPassword({pass1: new HiddenString(''), pass2: new HiddenString('')})
    const nextState = makeTypedState(reducer(state, action))
    expect(nextState.signup.passwordError.stringValue()).toEqual('Fields cannot be blank')
  })
  it('passes get updated', () => {
    const state = Constants.makeState()
    const action = SignupGen.createCheckPassword({
      pass1: new HiddenString('123456abcd'),
      pass2: new HiddenString('123456abcd'),
    })
    const nextState = makeTypedState(reducer(state, action))
    expect(nextState.signup.passwordError.stringValue()).toEqual('')
    expect(nextState.signup.password.stringValue()).toEqual(action.payload.pass1.stringValue())
    expect(nextState.signup.password.stringValue()).toEqual(action.payload.pass2.stringValue())
  })
})

describe('deviceScreen', () => {
  it('trims name', () => {
    const state = Constants.makeState()
    const action = SignupGen.createCheckDevicename({devicename: '   a name  \n'})
    const nextState = makeTypedState(reducer(state, action))
    expect(nextState.signup.devicename).toEqual('a name')
  })

  it("ignores if devicename doesn't match", () => {
    const state = {...Constants.makeState(), devicename: 'a device'}
    const action = SignupGen.createCheckedDevicename({devicename: 'different name', error: 'an error'})
    const nextState = makeTypedState(reducer(state, action))
    // doesn't update
    expect(nextState).toEqual(makeTypedState(state))
  })

  it('shows error', () => {
    const state = {...Constants.makeState(), devicename: 'devicename'}
    const action = SignupGen.createCheckedDevicename({devicename: 'devicename', error: 'an error'})
    const nextState = makeTypedState(reducer(makeTypedState(state).signup, action))
    expect(nextState.signup.devicename).toEqual(action.payload.devicename)
    expect(nextState.signup.devicenameError).toEqual(action.payload.error)
  })
})

describe('actually sign up', () => {
  it('bails on devicenameError', () => {
    const state = {...Constants.makeState(), devicenameError: 'error'}
    expect(_testing.reallySignupOnNoErrors(makeTypedState(state)).next().value).toBeUndefined()
  })
  it('bails on emailError', () => {
    const state = {...Constants.makeState(), emailError: 'error'}
    expect(_testing.reallySignupOnNoErrors(makeTypedState(state)).next().value).toBeUndefined()
  })
  it('bails on inviteCodeError', () => {
    const state = {...Constants.makeState(), inviteCodeError: 'error'}
    expect(_testing.reallySignupOnNoErrors(makeTypedState(state)).next().value).toBeUndefined()
  })
  it('bails on nameError', () => {
    const state = {...Constants.makeState(), nameError: 'error'}
    expect(_testing.reallySignupOnNoErrors(makeTypedState(state)).next().value).toBeUndefined()
  })
  it('bails on usernameError', () => {
    const state = {...Constants.makeState(), usernameError: 'error'}
    expect(_testing.reallySignupOnNoErrors(makeTypedState(state)).next().value).toBeUndefined()
  })
  it('bails on signupError', () => {
    const state = {...Constants.makeState(), signupError: new RPCError('error', 0)}
    expect(_testing.reallySignupOnNoErrors(makeTypedState(state)).next().value).toBeUndefined()
  })

  const validSignup = {
    ...Constants.makeState(),
    devicename: 'a valid devicename',
    inviteCode: '1234566',
    username: 'testuser',
  }

  const signupError = new Error('Missing data for signup')

  it('bails on missing devicename', () => {
    expect(() =>
      _testing.reallySignupOnNoErrors(makeTypedState({...validSignup, devicename: ''})).next()
    ).toThrow(signupError)
  })
  it('bails on missing inviteCode', () => {
    expect(() =>
      _testing.reallySignupOnNoErrors(makeTypedState({...validSignup, inviteCode: ''})).next()
    ).toThrow(signupError)
  })
  it('bails on missing username', () => {
    expect(() =>
      _testing.reallySignupOnNoErrors(makeTypedState({...validSignup, username: ''})).next()
    ).toThrow(signupError)
  })
  it('updates error', () => {
    const state = Constants.makeState()
    const action = SignupGen.createSignedup({error: new RPCError('an error', 0)})
    const nextState = makeTypedState(reducer(state, action))
    expect(nextState.signup.signupError).toEqual(action.payload.error)
    expect(_testing.showErrorOrCleanupAfterSignup(nextState)).toEqual(
      RouteTreeGen.createNavigateAppend({path: ['signupError']})
    )
  })

  it('after signup cleanup', () => {
    const state = Constants.makeState()
    const action = SignupGen.createSignedup()
    const nextState = makeTypedState(reducer(state, action))
    expect(_testing.showErrorOrCleanupAfterSignup(nextState)).toEqual(SignupGen.createRestartSignup())
  })
})
