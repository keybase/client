// @flow

import Pinentry from './index.render'
import type {DumbComponentMap} from '../constants/types/more'
import type {Props} from './index.render'

const propsNormal: Props = {
  onSubmit: (passphrase, features) => console.log('Pinentry', {passphrase, features}),
  onCancel: () => {},
  features: {
    'saveInKeychain': {
      allow: true,
      defaultValue: false,
      readonly: false,
      label: 'Save in keychain',
    },
    'showTyping': {
      allow: true,
      defaultValue: false,
      readonly: false,
      label: 'Show typing',
    },
  },
  prompt: 'Enter your passphrase to unlock the secret key for home computer.',
}

const dumbComponentMap: DumbComponentMap<Pinentry> = {
  component: Pinentry,
  mocks: {
    'Normal': propsNormal,
    'With Error': {
      ...propsNormal,
      retryLabel: 'That passphrase is incorrect.',
    },
  },
}

export default {
  'Pinentry': dumbComponentMap,
}
