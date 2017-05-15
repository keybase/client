// @flow

import Pinentry from './index.render'
import {PassphraseCommonPassphraseType} from '../constants/types/flow-types'
import type {DumbComponentMap} from '../constants/types/more'
import type {Props} from './index.render'

const propsNormal: Props = {
  onSubmit: (passphrase, features) =>
    console.log('Pinentry', {passphrase, features}),
  onCancel: () => {},
  features: {
    saveInKeychain: {
      allow: true,
      defaultValue: false,
      readonly: false,
      label: 'Save in keychain',
    },
    showTyping: {
      allow: true,
      defaultValue: false,
      readonly: false,
      label: 'Show typing',
    },
  },
  prompt: 'Enter your passphrase to unlock the secret key for home computer.',
  type: PassphraseCommonPassphraseType.passPhrase,
}

const paperkeyNormal: Props = {
  ...propsNormal,
  parentProps: {
    style: {
      height: 300,
    },
  },
  type: PassphraseCommonPassphraseType.paperKey,
  prompt: 'Enter your paper key to continue.',
  features: {
    showTyping: {
      allow: true,
      defaultValue: true,
      readonly: false,
      label: 'Show typing',
    },
  },
}

const dumbComponentMap: DumbComponentMap<Pinentry> = {
  component: Pinentry,
  mocks: {
    'Passphrase Normal': propsNormal,
    'Passphrase With Error': {
      ...propsNormal,
      retryLabel: 'That passphrase is incorrect.',
    },
    'Passphrase Save in keychain': {
      ...propsNormal,
      features: {
        ...propsNormal.features,
        saveInKeychain: {
          allow: true,
          defaultValue: true,
          readonly: false,
          label: 'Save in keychain',
        },
      },
    },
    'PaperKey Normal': {
      ...paperkeyNormal,
    },
    'PaperKey Error': {
      ...paperkeyNormal,
      retryLabel: 'That paperkey is invalid.',
    },
  },
}

export default {
  Pinentry: dumbComponentMap,
}
