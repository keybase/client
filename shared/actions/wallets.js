// @flow
import * as Constants from '../constants/wallets'
import * as Types from '../constants/types/rpc-stellar-gen'
import * as WalletsGen from './wallets-gen'
import * as Saga from '../util/saga'

const walletsRefresh = (action: WalletsGen.WalletsRefreshPayload) => Saga.call(Types.localGetWalletAccountsLocalRpcPromise, {})

const walletsRefreshSuccess = (res: any) => Saga.put(WalletsGen.createWalletsReceived({wallets: res.map(wallet => Constants.walletResultToWallet(wallet))}))

function* walletsSaga(): Saga.SagaGenerator<any, any> {
  yield Saga.safeTakeEveryPure(WalletsGen.walletsRefresh, walletsRefresh, walletsRefreshSuccess)
}

export default walletsSaga
