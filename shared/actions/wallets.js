// @flow
import * as Constants from '../constants/wallets'
import * as Types from '../constants/types/wallets'
import * as RPCTypes from '../constants/types/rpc-stellar-gen'
import * as Saga from '../util/saga'
import * as WalletsGen from './wallets-gen'
import * as Route from './route-tree'
import logger from '../logger'
import type {TypedState} from '../constants/reducer'
import {walletsTab} from '../constants/tabs'

const loadAccounts = (action: WalletsGen.LoadAccountsPayload | WalletsGen.LinkedExistingAccountPayload) =>
  !action.error && Saga.call(RPCTypes.localGetWalletAccountsLocalRpcPromise)

const loadAccountsSuccess = (
  res: ?Array<Types.Account>,
  action: WalletsGen.LoadAccountsPayload | WalletsGen.LinkedExistingAccountPayload
) =>
  action.error
    ? null
    : Saga.put(
        WalletsGen.createAccountsReceived({
          accounts: (res || []).map(account => Constants.accountResultToAccount(account)),
        })
      )

const loadAssets = (
  action:
    | WalletsGen.LoadAssetsPayload
    | WalletsGen.SelectAccountPayload
    | WalletsGen.LinkedExistingAccountPayload
) =>
  !action.error &&
  Saga.call(RPCTypes.localGetAccountAssetsLocalRpcPromise, {accountID: action.payload.accountID})

const loadAssetsSuccess = (
  res: ?Array<RPCTypes.AccountAssetLocal>,
  action:
    | WalletsGen.LoadAssetsPayload
    | WalletsGen.SelectAccountPayload
    | WalletsGen.LinkedExistingAccountPayload
) => {
  if (action.error) {
    return
  }
  const {accountID} = action.payload
  return Saga.put(
    WalletsGen.createAssetsReceived({
      accountID,
      assets: (res || []).map(assets => Constants.assetsResultToAssets(assets)),
    })
  )
}

const loadPayments = (
  action:
    | WalletsGen.LoadPaymentsPayload
    | WalletsGen.SelectAccountPayload
    | WalletsGen.LinkedExistingAccountPayload
) =>
  !action.error && Saga.call(RPCTypes.localGetPaymentsLocalRpcPromise, {accountID: action.payload.accountID})

const loadPaymentsSuccess = (
  res: RPCTypes.PaymentsPageLocal,
  action:
    | WalletsGen.LoadPaymentsPayload
    | WalletsGen.SelectAccountPayload
    | WalletsGen.LinkedExistingAccountPayload
) => {
  if (action.error) {
    return
  }
  const {accountID} = action.payload
  return Saga.put(
    WalletsGen.createPaymentsReceived({
      accountID,
      payments: (res.payments || []).map(elem => Constants.paymentResultToPayment(elem)).filter(Boolean),
    })
  )
}

const linkExistingAccount = (state: TypedState, action: WalletsGen.LinkExistingAccountPayload) => {
  const {name, secretKey} = action.payload
  return RPCTypes.localLinkNewWalletAccountLocalRpcPromise(
    {
      name,
      secretKey: secretKey.stringValue(),
    },
    Constants.linkExistingWaitingKey
  )
    .then(accountIDString => Types.stringToAccountID(accountIDString))
    .then(accountID => [
      WalletsGen.createSelectAccount({accountID, show: true}),
      WalletsGen.createLinkedExistingAccount({accountID}),
    ])
    .catch(err => WalletsGen.createLinkedExistingAccountError({error: err.desc, name, secretKey}))
}

const validateAccountName = (state: TypedState, action: WalletsGen.ValidateAccountNamePayload) => {
  const {name} = action.payload
  return RPCTypes.localValidateAccountNameLocalRpcPromise({name})
    .then(() => WalletsGen.createValidatedAccountName({name}))
    .catch(err => {
      logger.warn(`Errpr`)
      return WalletsGen.createValidatedAccountNameError({error: err.desc, name})
    })
}

const validateSecretKey = (state: TypedState, action: WalletsGen.ValidateSecretKeyPayload) => {
  const {secretKey} = action.payload
  return RPCTypes.localValidateSecretKeyLocalRpcPromise({secretKey: secretKey.stringValue()})
    .then(() => WalletsGen.createValidatedSecretKey({secretKey}))
    .catch(err => WalletsGen.createValidatedSecretKeyError({error: err.desc, secretKey}))
}

const navigateToAccount = (
  action: WalletsGen.SelectAccountPayload | WalletsGen.LinkedExistingAccountPayload
) => {
  if (action.type === WalletsGen.linkedExistingAccount && action.error) {
    // Link existing failed, don't nav
    return
  }
  if (action.type === WalletsGen.selectAccount && !action.payload.show) {
    // we don't want to show, don't nav
    return
  }
  return Saga.put(Route.navigateTo([{props: {}, selected: walletsTab}, {props: {}, selected: null}]))
}

function* walletsSaga(): Saga.SagaGenerator<any, any> {
  yield Saga.safeTakeEveryPure(
    [WalletsGen.loadAccounts, WalletsGen.linkedExistingAccount],
    loadAccounts,
    loadAccountsSuccess
  )
  yield Saga.safeTakeEveryPure(
    [WalletsGen.loadAssets, WalletsGen.selectAccount, WalletsGen.linkedExistingAccount],
    loadAssets,
    loadAssetsSuccess
  )
  yield Saga.safeTakeEveryPure(
    [WalletsGen.loadPayments, WalletsGen.selectAccount, WalletsGen.linkedExistingAccount],
    loadPayments,
    loadPaymentsSuccess
  )
  yield Saga.safeTakeEveryPurePromise(WalletsGen.linkExistingAccount, linkExistingAccount)
  yield Saga.safeTakeEveryPurePromise(WalletsGen.validateAccountName, validateAccountName)
  yield Saga.safeTakeEveryPurePromise(WalletsGen.validateSecretKey, validateSecretKey)
  yield Saga.safeTakeEveryPure(
    [WalletsGen.selectAccount, WalletsGen.linkedExistingAccount],
    navigateToAccount
  )
}

export default walletsSaga
