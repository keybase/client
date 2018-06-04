// @flow
import * as Constants from '../constants/wallets'
import * as I from 'immutable'
import * as Saga from '../util/saga'
import * as Types from '../constants/types/rpc-stellar-gen'
import * as WalletsGen from './wallets-gen'
import type {TypedState} from '../util/container'

const walletsRefresh = (action: WalletsGen.WalletsRefreshPayload) =>
  Saga.call(Types.localGetWalletAccountsLocalRpcPromise, {})

const walletsRefreshSuccess = (res: any) =>
  Saga.put(
    WalletsGen.createWalletsReceived({wallets: res.map(wallet => Constants.walletResultToWallet(wallet))})
  )

function* loadEverything(action: WalletsGen.LoadEverythingPayload) {
  yield Saga.put(WalletsGen.createWalletsRefresh())
  yield Saga.take(WalletsGen.walletsReceived)
  const state: TypedState = yield Saga.select()
  const wallets = state.wallets.walletMap.keys()
  for (const accountID of wallets) {
    yield Saga.put(WalletsGen.createLoadAssets({accountID}))
    yield Saga.put(WalletsGen.createLoadPayments({accountID}))
  }
}

const loadAssets = (action: WalletsGen.LoadAssetsPayload) => {
  const {accountID} = action.payload
  return Saga.call(Types.localGetAccountAssetsLocalRpcPromise, {accountID})
}

const loadAssetsSuccess = (res: any, action: WalletsGen.LoadAssetsPayload) => {
  const {accountID} = action.payload
  return Saga.put(
    WalletsGen.createAssetsReceived({
      accountID,
      assets: Constants.assetsResultToAssets(res[0]),
    })
  )
}

const loadPayments = (action: WalletsGen.LoadPaymentsPayload) => {
  const {accountID} = action.payload
  return Saga.call(Types.localGetPaymentsLocalRpcPromise, {accountID})
}

const loadPaymentsSuccess = (res: any, action: WalletsGen.LoadPaymentsPayload) => {
  const {accountID} = action.payload
  return Saga.put(
    WalletsGen.createPaymentsReceived({
      accountID,
      payments: I.List(res.map(elem => Constants.paymentResultToPayment(elem))),
    })
  )
}

function* walletsSaga(): Saga.SagaGenerator<any, any> {
  yield Saga.safeTakeEveryPure(WalletsGen.walletsRefresh, walletsRefresh, walletsRefreshSuccess)
  yield Saga.safeTakeEveryPure(WalletsGen.loadAssets, loadAssets, loadAssetsSuccess)
  yield Saga.safeTakeEveryPure(WalletsGen.loadPayments, loadPayments, loadPaymentsSuccess)
  // Debugging saga -- remove before launching.
  yield Saga.safeTakeEvery(WalletsGen.loadEverything, loadEverything)
}

export default walletsSaga
