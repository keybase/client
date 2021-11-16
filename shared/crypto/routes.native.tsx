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
  [Constants.encryptTab]: {
    getScreen: (): typeof EncryptInput => require('./operations/encrypt/index').EncryptInput,
  },
  [Constants.decryptTab]: {
    getScreen: (): typeof DecryptInput => require('./operations/decrypt/index').DecryptInput,
  },
  [Constants.signTab]: {
    getScreen: (): typeof SignInput => require('./operations/sign/index').SignInput,
  },
  [Constants.verifyTab]: {
    getScreen: (): typeof VerifyInput => require('./operations/verify/index').VerifyInput,
  },
}
export const newModalRoutes = {
  cryptoTeamBuilder: {getScreen: (): typeof TeamBuilder => require('../team-building/container').default},
  [Constants.encryptOutput]: {
    getScreen: (): typeof EncryptOutput => require('./operations/encrypt/index').EncryptOutput,
  },
  [Constants.decryptOutput]: {
    getScreen: (): typeof DecryptOutput => require('./operations/decrypt/index').DecryptOutput,
  },
  [Constants.signOutput]: {
    getScreen: (): typeof SignOutput => require('./operations/sign/index').SignOutput,
  },
  [Constants.verifyOutput]: {
    getScreen: (): typeof VerifyOutput => require('./operations/verify/index').VerifyOutput,
  },
}
