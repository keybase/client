import {HeaderLeftCancel2} from '../common-adapters/header-hoc'
import * as Constants from '../constants/crypto'
import type TeamBuilder from '../team-building/container'
import type {EncryptInput, EncryptOutput} from './operations/encrypt'
import type {DecryptInput, DecryptOutput} from './operations/decrypt'
import type {SignInput, SignOutput} from './operations/sign'
import type {VerifyInput, VerifyOutput} from './operations/verify'

const inputOptions = {
  headerShown: true,
  needsKeyboard: true,
} as const

const outputOptions = {
  headerLeft: p => <HeaderLeftCancel2 {...p} />,
  headerShown: true,
  needsKeyboard: false,
} as const

export const newRoutes = {
  [Constants.encryptTab]: {
    getOptions: {...inputOptions, title: 'Encrypt'},
    getScreen: (): typeof EncryptInput => require('./operations/encrypt').EncryptInput,
  },
  [Constants.decryptTab]: {
    getOptions: {...inputOptions, title: 'Decrypt'},
    getScreen: (): typeof DecryptInput => require('./operations/decrypt').DecryptInput,
  },
  [Constants.signTab]: {
    getOptions: {...inputOptions, title: 'Sign'},
    getScreen: (): typeof SignInput => require('./operations/sign').SignInput,
  },
  [Constants.verifyTab]: {
    getOptions: {...inputOptions, title: 'Verify'},
    getScreen: (): typeof VerifyInput => require('./operations/verify').VerifyInput,
  },
}
export const newModalRoutes = {
  cryptoTeamBuilder: {getScreen: (): typeof TeamBuilder => require('../team-building/container').default},
  [Constants.encryptOutput]: {
    getOptions: {...outputOptions, title: 'Encrypt'},
    getScreen: (): typeof EncryptOutput => require('./operations/encrypt').EncryptOutput,
  },
  [Constants.decryptOutput]: {
    getOptions: {...outputOptions, title: 'Decrypt'},
    getScreen: (): typeof DecryptOutput => require('./operations/decrypt').DecryptOutput,
  },
  [Constants.signOutput]: {
    getOptions: {...outputOptions, title: 'Sign'},
    getScreen: (): typeof SignOutput => require('./operations/sign').SignOutput,
  },
  [Constants.verifyOutput]: {
    getOptions: {...outputOptions, title: 'Verify'},
    getScreen: (): typeof VerifyOutput => require('./operations/verify').VerifyOutput,
  },
}
