// @flow
import * as Constants from '../constants/wallets'
import * as Types from '../constants/types/wallets'
import * as I from 'immutable'
import * as RPCTypes from '../constants/types/rpc-stellar-gen'

import * as Saga from '../util/saga'
import * as WalletsGen from './wallets-gen'
import type {TypedState} from '../util/container'

const loadWallets = (action: WalletsGen.LoadWalletsPayload) =>
  Saga.call(RPCTypes.localGetWalletAccountsLocalRpcPromise, {})

const loadWalletsSuccess = (res: ?Array<Types.Wallet>) =>
  Saga.put(
    WalletsGen.createWalletsReceived({
      wallets: (res || []).map(wallet => Constants.walletResultToWallet(wallet)),
    })
  )

const loadAssets = (action: WalletsGen.LoadAssetsPayload) => {
  const {accountID} = action.payload
  return Saga.call(RPCTypes.localGetAccountAssetsLocalRpcPromise, {accountID})
}

const loadAssetsSuccess = (res: any, action: WalletsGen.LoadAssetsPayload) => {
  const {accountID} = action.payload
  return Saga.put(
    WalletsGen.createAssetsReceived({
      accountID,
      assets: (res || []).map(assets => Constants.assetsResultToAssets(assets)),
    })
  )
}

const loadPayments = (action: WalletsGen.LoadPaymentsPayload) => {
  const {accountID} = action.payload
  return Saga.call(RPCTypes.localGetPaymentsLocalRpcPromise, {accountID})
}

const loadPaymentsSuccess = (res: any, action: WalletsGen.LoadPaymentsPayload) => {
  const {accountID} = action.payload
  return Saga.put(
    WalletsGen.createPaymentsReceived({
      accountID,
      payments: res.map(elem => Constants.paymentResultToPayment(elem)),
    })
  )
}

function* loadEverything(action: WalletsGen.LoadEverythingPayload) {
  yield Saga.put(WalletsGen.createLoadWallets())
  yield Saga.take(WalletsGen.walletsReceived)
  const state: TypedState = yield Saga.select()
  const wallets = state.wallets.walletMap.keys()
  for (const accountID of wallets) {
    yield Saga.put(WalletsGen.createLoadAssets({accountID}))
    yield Saga.put(WalletsGen.createLoadPayments({accountID}))
  }
}
function* walletsSaga(): Saga.SagaGenerator<any, any> {
  yield Saga.safeTakeEveryPure(WalletsGen.loadWallets, loadWallets, loadWalletsSuccess)
  yield Saga.safeTakeEveryPure(WalletsGen.loadAssets, loadAssets, loadAssetsSuccess)
  yield Saga.safeTakeEveryPure(WalletsGen.loadPayments, loadPayments, loadPaymentsSuccess)
  // Debugging saga -- remove before launching.
  yield Saga.safeTakeEvery(WalletsGen.loadEverything, loadEverything)
}

export default walletsSaga
