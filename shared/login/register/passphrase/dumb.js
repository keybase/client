// @flow

import Render from './index.render'
import type {DumbComponentMap} from '../../../constants/types/more'

const baseMock = {
  prompt: 'Type in passphrase',
  onSubmit: () => console.log('Passphrase:onSubmit'),
  onChange: p => console.log('Passphrase:onChange ', p),
  passphrase: null,
  onBack: () => console.log('Passphrase:onSubmit'),
  onForgotPassphrase: () => console.log('Passphrase:onSubmit'),
  waitingForResponse: false,
  error: null,
  username: 'ciphersaurus_rex',
  showTyping: false,
  saveInKeychain: false,
  toggleShowTyping: () => console.log('Passphrase:toggleShowTyping'),
  toggleSaveInKeychain: () => console.log('Passphrase:toggleSaveInKeychain'),
}

const dumbComponentMap: DumbComponentMap<Render> = {
  component: Render,
  mocks: {
    'no passphrase': baseMock,
    'error - no passphrase': {...baseMock, error: 'error here!'},
    'Show Typing': {...baseMock, showTyping: true, passphrase: 'hunter2'},
    'Show Typing - error': {...baseMock, showTyping: true, passphrase: 'hunter2', error: 'too weak'},
  },
}

export default dumbComponentMap
