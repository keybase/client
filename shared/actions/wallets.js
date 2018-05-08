// @flow
// import * as Constants from '../constants/wallets'
// import * as Types from '../constants/types/wallets'
import * as WalletsGen from './wallets-gen'
import * as Saga from '../util/saga'

const logSomeStuff = (action: WalletsGen.WalletsRefreshPayload) => {
  console.log('Sagas are alive!')
}

function* walletsSaga(): Saga.SagaGenerator<any, any> {
  yield Saga.safeTakeEveryPure(WalletsGen.walletsRefresh, logSomeStuff)
}

export default walletsSaga
