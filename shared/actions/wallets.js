// @flow
import * as Constants from '../constants/wallets'
import * as Types from '../constants/types/wallets'
import * as RPCTypes from '../constants/types/rpc-stellar-gen'
import * as Saga from '../util/saga'
import * as WalletsGen from './wallets-gen'
import * as Route from './route-tree'
import {walletsTab} from '../constants/tabs'

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

const linkExistingAccount = (action: WalletsGen.LinkExistingAccountPayload) => {
  const {name, secretKey} = action.payload
  return RPCTypes.localLinkNewWalletAccountLocalRpcPromise({
    name,
    secretKey: secretKey.stringValue(),
  }).then(accountID => [
    WalletsGen.createLoadAccounts(),
    WalletsGen.createSelectAccount({accountID: Types.stringToAccountID(accountID), show: true}),
  ])
}

const validateAccountName = (action: WalletsGen.ValidateAccountNamePayload) => {
  const {name} = action.payload
  return RPCTypes.localValidateAccountNameLocalRpcPromise({name})
    .then(() => WalletsGen.createValidateAccountNameError({error: '', name}))
    .catch(err => WalletsGen.createValidateAccountNameError({error: err.desc, name}))
}

const validateSecretKey = (action: WalletsGen.ValidateSecretKeyPayload) => {
  const {secretKey} = action.payload
  return RPCTypes.localValidateSecretKeyLocalRpcPromise({secretKey: secretKey.stringValue()})
    .then(() => WalletsGen.createValidateSecretKeyError({error: '', secretKey}))
    .catch(err => WalletsGen.createValidateSecretKeyError({error: err.desc, secretKey}))
}

const navigateToAccount = (action: WalletsGen.SelectAccountPayload) => {
  const {show} = action.payload
  if (!show) {
    return
  }
  return Saga.put(Route.navigateTo([{props: {}, selected: walletsTab}, {props: {}, selected: null}]))
}

function* walletsSaga(): Saga.SagaGenerator<any, any> {
  yield Saga.safeTakeEveryPure(WalletsGen.loadAccounts, loadAccounts, loadAccountsSuccess)
  yield Saga.safeTakeEveryPure(WalletsGen.loadAssets, loadAssets, loadAssetsSuccess)
  yield Saga.safeTakeEveryPure(WalletsGen.loadPayments, loadPayments, loadPaymentsSuccess)
  yield Saga.safeTakeEveryPure(WalletsGen.selectAccount, loadAssets, loadAssetsSuccess)
  yield Saga.safeTakeEveryPure(WalletsGen.selectAccount, loadPayments, loadPaymentsSuccess)
  yield Saga.safeTakeEveryPurePromise(WalletsGen.linkExistingAccount, linkExistingAccount)
  yield Saga.safeTakeEveryPurePromise(
    action => action.type === WalletsGen.validateAccountName && !action.error,
    validateAccountName
  )
  yield Saga.safeTakeEveryPurePromise(
    action => action.type === WalletsGen.validateSecretKey && !action.error,
    validateSecretKey
  )
  yield Saga.safeTakeEveryPure(WalletsGen.selectAccount, navigateToAccount)
}

export default walletsSaga
