// @flow
// import * as Constants from '../constants/wallets'
import * as Types from '../constants/types/rpc-stellar-gen'
import * as WalletsGen from './wallets-gen'
import * as Saga from '../util/saga'

const walletsRefresh = (action: WalletsGen.WalletsRefreshPayload) => Saga.call(Types.getWalletAccountsLocalRpcPromise)

const walletsRefreshSuccess = (res: any) => console.warn(res)

function* walletsSaga(): Saga.SagaGenerator<any, any> {
  yield Saga.safeTakeEveryPure(WalletsGen.walletsRefresh, walletsRefresh, walletsRefreshSuccess)
}

export default walletsSaga
