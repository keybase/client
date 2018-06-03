// @flow
import * as Constants from '../constants/wallets'
import * as Types from '../constants/types/rpc-stellar-gen'
import * as WalletsGen from './wallets-gen'
import * as Saga from '../util/saga'
import type {TypedState} from '../../util/container'

const walletsRefresh = (action: WalletsGen.WalletsRefreshPayload) => Saga.call(Types.localGetWalletAccountsLocalRpcPromise, {})

const walletsRefreshSuccess = (res: any) => Saga.put(WalletsGen.createWalletsReceived({wallets: res.map(wallet => Constants.walletResultToWallet(wallet))}))

const walletsLoadAllAssets = (action: WalletsGen.WalletsLoadAllAssetsPayload, state: TypedState) => {
  const wallets = state.wallets.walletMap.keys()
  const actions = []
  console.warn(wallets)
  for (const accountID of wallets) {
    actions.push(Saga.put(WalletsGen.createLoadAssets({accountID})))
  }
  return Saga.sequentially(actions)
}

const walletsLoadAllAssetsSuccess = (res: any) => { console.warn('loadAllAssets done') }

const walletsLoadAssets = (action: WalletsGen.WalletsLoadAssetsPayload) => {
  const {accountID} = action.payload
  return Saga.call(Types.localGetAccountAssetsLocalRpcPromise, {accountID})
}

const walletsLoadAssetsSuccess = (res: any, action: WalletsGen.WalletsLoadAssetsPayload) => {
  console.warn('res is ', res, action)
  const {accountID} = action.payload
  return Saga.put(WalletsGen.createAssetsReceived({
    accountID,
    assets: Constants.assetsResultToAssets(res[0]),
  }))
}

function* walletsSaga(): Saga.SagaGenerator<any, any> {
  yield Saga.safeTakeEveryPure(WalletsGen.walletsRefresh, walletsRefresh, walletsRefreshSuccess)
  yield Saga.safeTakeEveryPure(WalletsGen.walletsReceived, walletsLoadAllAssets, walletsLoadAllAssetsSuccess)
  yield Saga.safeTakeEveryPure(WalletsGen.loadAssets, walletsLoadAssets, walletsLoadAssetsSuccess)
}

export default walletsSaga
