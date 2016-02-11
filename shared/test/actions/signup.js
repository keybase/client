import assert from 'assert'

import engine from '../../engine'
import configureStore from '../../store/configure-store'
import * as signupActions from '../../actions/signup'

console.groupCollapsed = () => {}
console.groupEnd = () => {}

const store = configureStore()

describe('Login', function () {
  this.timeout(5e3)

  before(() => {
    engine.setFailOnError()
  })

  describe('Check Username and email', () => {
    it('not allow empty username', () => {
      return store.dispatch(signupActions.checkUsernameEmail('', 'foo@dev.null')).then(() => {
        assert(store.getState().signup.usernameError != null, 'No username error')
        assert(store.getState().signup.emailError == null, 'Email was fine, should be no error')
      })
    })

    it('not allow empty email', () => {
      return store.dispatch(signupActions.checkUsernameEmail('fooobar', '')).then(() => {
        assert(store.getState().signup.emailError != null, 'No email error')
      })
    })
  })

  describe('Signup for an account', () => {
    const username = `Test${Math.floor(Math.random() * 1e5)}`
    console.log(`Using username: ${username}`)

    it('has a valid account', () => {
      return store.dispatch(signupActions.checkInviteCode('202020202020202020202020'))
        .then(() => store.dispatch(signupActions.checkUsernameEmail(username, `null+${username}@keyba.se`)))
        .then(() => store.dispatch(signupActions.checkPassphrase('asdfasdfasdf', 'asdfasdfasdf')))
        .then(() => store.dispatch(signupActions.submitDeviceName('TEST1', true)))
    })

    it('is in the paper key phase and we have a paperkey', () => {
      const {phase, paperkey} = store.getState().signup
      assert.equal(phase, 'paperkey')
      assert(paperkey != null, 'Paperkey is null')
    })

    it('is in the success phase and we have a paper key', () => {
      store.dispatch(signupActions.showSuccess())
      const {phase} = store.getState().signup
      assert.equal(phase, 'success')
    })

    it('has no outstanding rpc responses', () => {
      assert.deepEqual(Object.keys(engine.sessionIDToResponse).filter(k => engine.sessionIDToResponse[k]), [])
    })
  })
})
