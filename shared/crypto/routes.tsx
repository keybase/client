import type * as C from '@/constants'
import * as Constants from '@/constants/crypto'
import cryptoRoot from './sub-nav/page'
import cryptoTeamBuilder from '../team-building/page'
import decryptIn from './operations/decrypt.in.page'
import decryptOut from './operations/decrypt.out.page'
import encryptIn from './operations/encrypt.in.page'
import encryptOut from './operations/encrypt.out.page'
import signIn from './operations/sign.in.page'
import signOut from './operations/sign.out.page'
import verifyIn from './operations/verify.in.page'
import verifyOut from './operations/verify.out.page'

export const newRoutes = {
  [Constants.encryptTab]: encryptIn,
  [Constants.decryptTab]: decryptIn,
  [Constants.signTab]: signIn,
  [Constants.verifyTab]: verifyIn,
  cryptoRoot,
}
export const newModalRoutes = {
  cryptoTeamBuilder,
  [Constants.encryptOutput]: encryptOut,
  [Constants.decryptOutput]: decryptOut,
  [Constants.signOutput]: signOut,
  [Constants.verifyOutput]: verifyOut,
}

export type RootParamListCrypto = C.PagesToParams<typeof newRoutes & typeof newModalRoutes>
