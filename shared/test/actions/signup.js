import assert from 'assert'

import engine from '../../engine'
import configureStore from '../../store/configure-store'
import * as signupActions from '../../actions/signup'
import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'

chai.use(chaiAsPromised)

console.groupCollapsed = () => {}
console.groupEnd = () => {}

const store = configureStore()
const inviteCode = '202020202020202020202020'

describe('Signup', function () {
  this.timeout(5e3)

  before(() => {
    engine.setFailOnError()
  })

  describe('Check valid invite code', () => {
    it('should accept a valid invite code', () => {
      return store.dispatch(signupActions.checkInviteCode(inviteCode)).then(() => {

      })
    })

    it('should reject an invalid invite code', () => {
      return store.dispatch(signupActions.checkInviteCode('fakecode')).then(() => {
        assert.fail(null, null, 'Should have rejected a fake invite code')
      }).catch(() => {
        assert(store.getState().signup.inviteCodeError != null, 'Invite code error')
      })
    })
  })

  describe('Check Username and email', () => {
    it('not allow empty username', () => {
      return store.dispatch(signupActions.checkUsernameEmail('', 'foo@dev.null')).then(() => {
        assert(store.getState().signup.usernameError != null, 'username error')
        assert(store.getState().signup.emailError == null, 'Email was fine, should be no error')
      })
    })

    it('should trim spaces on usernames', () => {
      return store.dispatch(signupActions.checkUsernameEmail('  ', 'foo@dev.null')).then(() => {
        assert(store.getState().signup.usernameError != null, 'There is a username error')
      })
    })

    it('trim spaces on emails', () => {
      return store.dispatch(signupActions.checkUsernameEmail('', '   ')).then(() => {
        assert(store.getState().signup.emailError != null, 'There is an email error')
      })
    })

    it('should not allow spaces', () => {
      return store.dispatch(signupActions.checkUsernameEmail('hello world', '')).then(() => {
        assert(store.getState().signup.emailError != null, 'There is an email error')
      })
    })

    it('should not allow spaces', () => {
      return store.dispatch(signupActions.checkUsernameEmail('hello world', 'foo@dev.null')).then(() => {
        assert(store.getState().signup.usernameError != null, 'There is a username error')
      })
    })

    it('not allow empty email', () => {
      return store.dispatch(signupActions.checkUsernameEmail('fooobar', '')).then(() => {
        assert(store.getState().signup.emailError != null, 'There is an email error')
      })
    })

    it('should not allow a username that has been taken', () => {
      return store.dispatch(signupActions.checkUsernameEmail('t_alice', 'foo@dev.null')).then(() => {
        assert(store.getState().signup.usernameError != null, 'There is a username error')
      })
    })
  })

  describe('Passwords should check out', () => {
    it('should be at least 12 chars', () => {
      return store.dispatch(signupActions.checkPassphrase('foo', 'foo')).then(() => {
        assert(store.getState().signup.passphraseError != null, 'There is a passphrase error')
      })
    })

    it('passphrases should match', () => {
      return store.dispatch(signupActions.checkUsernameEmail('asdfasdfasdf', 'fdsafdsafdas')).then(() => {
        assert(store.getState().signup.passphraseError != null, 'There is a passphrase error')
      })
    })

    it('not empty passwords', () => {
      return store.dispatch(signupActions.checkUsernameEmail('', 'fdsafdsafdas')).then(() => {
        assert(store.getState().signup.passphraseError != null, 'There is a passphrase error')
      })
    })
  })

  describe('Reset signup', () => {
    it('should reset the phase to inviteCode', () => {
      store.dispatch(signupActions.resetSignup())
      assert(store.getState().signup.phase === 'inviteCode', 'Resets the phase to inviteCode')
    })
  })

  describe('For an account', () => {
    const username = `Test${Math.floor(Math.random() * 1e5)}`
    console.log(`Using username: ${username}`)

    it('has a valid account', () => {
      return store.dispatch(signupActions.checkInviteCode(inviteCode))
        .then(() => store.dispatch(signupActions.checkUsernameEmail(username, `null+${username}@keyba.se`)))
        .then(() => store.dispatch(signupActions.checkPassphrase('asdfasdfasdf', 'asdfasdfasdf')))
        .then(() => store.dispatch(signupActions.submitDeviceName('TEST1', true, () => {
          const {phase, paperkey} = store.getState().signup
          assert.equal(phase, 'paperkey')
          assert(paperkey != null, 'Paperkey is not null')
          store.dispatch(signupActions.sawPaperKey())
        })))
    })

    it('is in the success phase', () => {
      store.dispatch(signupActions.showSuccess())
      const {phase} = store.getState().signup
      assert.equal(phase, 'success')
    })

    it('has no outstanding rpc responses', () => {
      assert.deepEqual(Object.keys(engine.sessionIDToResponse).filter(k => engine.sessionIDToResponse[k]), [])
    })
  })
})
