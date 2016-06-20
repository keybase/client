// @flow
import Login from './index.render'
import type {DumbComponentMap} from '../../constants/types/more'

import type LoginProps from './'

function createLogger (event) {
  return function () {
    console.log(`login/login => ${event}`, arguments)
  }
}

const props: LoginProps = {
  users: ['awendland'],
  onForgotPassphrase: createLogger('onForgotPassphrase'),
  onSignup: createLogger('onSignup'),
  onBack: createLogger('onBack'),
  onSomeoneElse: createLogger('onSomeoneElse'),
  error: null,
  waitingForResponse: false,
  showTyping: false,
  saveInKeychain: false,
  selectedUser: null,
  selectedUserChange: createLogger('selectedUserChange'),
  passphraseChange: createLogger('passphraseChange'),
  showTypingChange: createLogger('showTypingChange'),
  saveInKeychainChange: createLogger('saveInKeychainChange'),
  onSubmit: createLogger('onSubmit'),
}

export const dumbMap: DumbComponentMap<Login> = {
  component: Login,
  mocks: {
    'Single previous user': props,
    'Error': {
      ...props,
      error: 'Oh, no! What a mess!',
    },
    'Multiple previous users': {
      ...props,
      users: ['awendland', 'mgood', 'marcopolo'],
    },
  },
}

export default {
  'Login: Signed Out': dumbMap,
}
