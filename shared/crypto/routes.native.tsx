import * as Constants from '../constants/crypto'
import type CryptoSubNav from './sub-nav'
import type TeamBuilder from '../team-building/container'
import type {EncryptInput, EncryptOutput} from './operations/encrypt'
import type {DecryptInput, DecryptOutput} from './operations/decrypt'
import type {SignInput, SignOutput} from './operations/sign'
import type {VerifyInput, VerifyOutput} from './operations/verify'

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
