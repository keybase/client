// @flow
import * as Constants from '../constants/wallets'
import * as Types from '../constants/types/wallets'
import * as RPCTypes from '../constants/types/rpc-stellar-gen'
import * as Saga from '../util/saga'
import * as WalletsGen from './wallets-gen'

const loadAccounts = (action: WalletsGen.LoadAccountsPayload) =>
  Saga.call(RPCTypes.localGetWalletAccountsLocalRpcPromise)

const loadAccountsSuccess = (res: ?Array<Types.Account>) =>
  Saga.put(
    WalletsGen.createAccountsReceived({
      accounts: (res || []).map(account => Constants.accountResultToAccount(account)),
    })
  )

const loadAssets = (action: WalletsGen.LoadAssetsPayload) =>
  Saga.call(RPCTypes.localGetAccountAssetsLocalRpcPromise, {accountID: action.payload.accountID})

const loadAssetsSuccess = (res: any, action: WalletsGen.LoadAssetsPayload) => {
  const {accountID} = action.payload
  return Saga.put(
    WalletsGen.createAssetsReceived({
      accountID,
      assets: (res || []).map(assets => Constants.assetsResultToAssets(assets)),
    })
  )
}

const loadPayments = (action: WalletsGen.LoadPaymentsPayload) =>
  Saga.call(RPCTypes.localGetPaymentsLocalRpcPromise, {accountID: action.payload.accountID})

const loadPaymentsSuccess = (res: any, action: WalletsGen.LoadPaymentsPayload) => {
  const {accountID} = action.payload
  return Saga.put(
    WalletsGen.createPaymentsReceived({
      accountID,
      payments: res.payments.map(elem => Constants.paymentResultToPayment(elem)),
    })
  )
}

function* walletsSaga(): Saga.SagaGenerator<any, any> {
  yield Saga.safeTakeEveryPure(WalletsGen.loadAccounts, loadAccounts, loadAccountsSuccess)
  yield Saga.safeTakeEveryPure(WalletsGen.loadAssets, loadAssets, loadAssetsSuccess)
  yield Saga.safeTakeEveryPure(WalletsGen.loadPayments, loadPayments, loadPaymentsSuccess)
  yield Saga.safeTakeEveryPure(WalletsGen.selectAccount, loadAssets, loadAssetsSuccess)
  yield Saga.safeTakeEveryPure(WalletsGen.selectAccount, loadPayments, loadPaymentsSuccess)
}

export default walletsSaga
