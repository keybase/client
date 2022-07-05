import CryptoSubNav from './sub-nav'
import * as Constants from '../constants/crypto'
import TeamBuilder from '../team-building/container'
import {EncryptInput, EncryptOutput} from './operations/encrypt'
import {DecryptInput, DecryptOutput} from './operations/decrypt'
import {SignInput, SignOutput} from './operations/sign'
import {VerifyInput, VerifyOutput} from './operations/verify'

export const newRoutes = {
  cryptoRoot: {
    getScreen: (): typeof CryptoSubNav => require('./sub-nav').default,
  },
  // Encrypt
  [Constants.encryptTab]: {
    getScreen: (): typeof EncryptInput => require('./operations/encrypt/index').EncryptInput,
  },
  [Constants.encryptOutput]: {
    getScreen: (): typeof EncryptOutput => require('./operations/encrypt/index').EncryptOutput,
  },
  // Decrypt
  [Constants.decryptTab]: {
    getScreen: (): typeof DecryptInput => require('./operations/decrypt/index').DecryptInput,
  },
  [Constants.decryptOutput]: {
    getScreen: (): typeof DecryptOutput => require('./operations/decrypt/index').DecryptOutput,
  },
  // Sign
  [Constants.signTab]: {
    getScreen: (): typeof SignInput => require('./operations/sign/index').SignInput,
  },
  [Constants.signOutput]: {
    getScreen: (): typeof SignOutput => require('./operations/sign/index').SignOutput,
  },
  // Verify
  [Constants.verifyTab]: {
    getScreen: (): typeof VerifyInput => require('./operations/verify/index').VerifyInput,
  },
  [Constants.verifyOutput]: {
    getScreen: (): typeof VerifyOutput => require('./operations/verify/index').VerifyOutput,
  },
}
export const newModalRoutes = {
  cryptoTeamBuilder: {getScreen: (): typeof TeamBuilder => require('../team-building/container').default},
}
