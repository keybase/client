// @flow
import * as Constants from '../constants/wallets'
import * as Types from '../constants/types/rpc-stellar-gen'
import * as WalletsGen from './wallets-gen'
import * as Saga from '../util/saga'
import type {TypedState} from '../util/container'

const walletsRefresh = (action: WalletsGen.WalletsRefreshPayload) =>
  Saga.call(Types.localGetWalletAccountsLocalRpcPromise, {})

const walletsRefreshSuccess = (res: any) =>
  Saga.put(
    WalletsGen.createWalletsReceived({wallets: res.map(wallet => Constants.walletResultToWallet(wallet))})
  )

const loadAllAssets = (action: WalletsGen.LoadAllAssetsPayload, state: TypedState) => {
  const wallets = state.wallets.walletMap.keys()
  const actions = []
  console.warn(wallets)
  for (const accountID of wallets) {
    actions.push(Saga.put(WalletsGen.createLoadAssets({accountID})))
  }
  return Saga.sequentially(actions)
}

const loadAllAssetsSuccess = (res: any) => {
  console.warn('loadAllAssets done')
}

const loadAssets = (action: WalletsGen.LoadAssetsPayload) => {
  const {accountID} = action.payload
  return Saga.call(Types.localGetAccountAssetsLocalRpcPromise, {accountID})
}

const loadAssetsSuccess = (res: any, action: WalletsGen.LoadAssetsPayload) => {
  console.warn('res is ', res, action)
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
  console.warn('res is ', res, action)
  const {accountID} = action.payload
  return Saga.put(
    WalletsGen.createPaymentsReceived({
      accountID,
      payments: Constants.paymentResultToPayment(res[0]),
    })
  )
}

const loadAllPayments = (action: WalletsGen.LoadAllPaymentsPayload, state: TypedState) => {
  const wallets = state.wallets.walletMap.keys()
  const actions = []
  console.warn(wallets)
  for (const accountID of wallets) {
    actions.push(Saga.put(WalletsGen.createLoadPayments({accountID})))
  }
  return Saga.sequentially(actions)
}

const loadAllPaymentsSuccess = (res: any) => {
  console.warn('loadAllPayments done')
}

function* walletsSaga(): Saga.SagaGenerator<any, any> {
  yield Saga.safeTakeEveryPure(WalletsGen.walletsRefresh, walletsRefresh, walletsRefreshSuccess)
  yield Saga.safeTakeEveryPure(WalletsGen.walletsReceived, loadAllAssets, loadAllAssetsSuccess)
  yield Saga.safeTakeEveryPure(WalletsGen.walletsReceived, loadAllPayments, loadAllPaymentsSuccess)
  yield Saga.safeTakeEveryPure(WalletsGen.loadAssets, loadAssets, loadAssetsSuccess)
  yield Saga.safeTakeEveryPure(WalletsGen.loadPayments, loadPayments, loadPaymentsSuccess)
}

export default walletsSaga
