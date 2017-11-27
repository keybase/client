// @flow
import Pinentry, {type Props} from './index.desktop'
import {passphraseCommonPassphraseType} from '../constants/types/flow-types'
import type {DumbComponentMap} from '../constants/types/more'

const propsNormal: Props = {
  onSubmit: (passphrase, features) => console.log('Pinentry', {passphrase, features}),
  onCancel: () => {},
  showTyping: {
    allow: true,
    defaultValue: false,
    readonly: false,
    label: 'Show typing',
  },
  prompt: 'Enter your passphrase to unlock the secret key for home computer.',
  type: passphraseCommonPassphraseType.passPhrase,
}

const paperkeyNormal: Props = {
  ...propsNormal,
  parentProps: {
    style: {
      height: 300,
    },
  },
  type: passphraseCommonPassphraseType.paperKey,
  prompt: 'Enter your paper key to continue.',
  showTyping: {
    allow: true,
    defaultValue: true,
    readonly: false,
    label: 'Show typing',
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
