// @flow
import * as Constants from '../constants/wallets'
import * as Types from '../constants/types/wallets'
import * as RPCTypes from '../constants/types/rpc-stellar-gen'
import * as Saga from '../util/saga'
import * as WalletsGen from './wallets-gen'
import HiddenString from '../util/hidden-string'
import * as Route from './route-tree'
import logger from '../logger'
import type {TypedState} from '../constants/reducer'
import {walletsTab} from '../constants/tabs'

const loadAccounts = (
  state: TypedState,
  action: WalletsGen.LoadAccountsPayload | WalletsGen.LinkedExistingAccountPayload
) =>
  !action.error &&
  RPCTypes.localGetWalletAccountsLocalRpcPromise().then(res =>
    WalletsGen.createAccountsReceived({
      accounts: (res || []).map(account => Constants.accountResultToAccount(account)),
    })
  )

const loadAssets = (
  state: TypedState,
  action:
    | WalletsGen.LoadAssetsPayload
    | WalletsGen.SelectAccountPayload
    | WalletsGen.LinkedExistingAccountPayload
) =>
  !action.error &&
  RPCTypes.localGetAccountAssetsLocalRpcPromise({accountID: action.payload.accountID}).then(res =>
    WalletsGen.createAssetsReceived({
      accountID: action.payload.accountID,
      assets: (res || []).map(assets => Constants.assetsResultToAssets(assets)),
    })
  )

const loadPayments = (
  state: TypedState,
  action:
    | WalletsGen.LoadPaymentsPayload
    | WalletsGen.SelectAccountPayload
    | WalletsGen.LinkedExistingAccountPayload
) =>
  !action.error &&
  RPCTypes.localGetPaymentsLocalRpcPromise({accountID: action.payload.accountID}).then(res =>
    WalletsGen.createPaymentsReceived({
      accountID: action.payload.accountID,
      payments: (res.payments || []).map(elem => Constants.paymentResultToPayment(elem)).filter(Boolean),
    })
  )

const loadPaymentDetail = (state: TypedState, action: WalletsGen.LoadPaymentDetailPayload) =>
  RPCTypes.localGetPaymentDetailsLocalRpcPromise({
    accountID: action.payload.accountID,
    id: action.payload.paymentID,
  }).then(res =>
    WalletsGen.createPaymentDetailReceived({
      accountID: action.payload.accountID,
      paymentID: action.payload.paymentID,
      publicNote: res.publicNote,
      publicNoteType: res.publicNoteType,
      txID: res.txID,
    })
  )

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
    .then(accountID => WalletsGen.createLinkedExistingAccount({accountID}))
    .catch(err => {
      logger.warn(`Error linking existing account: ${err.desc}`)
      return WalletsGen.createLinkedExistingAccountError({error: err.desc, name, secretKey})
    })
}

const validateAccountName = (state: TypedState, action: WalletsGen.ValidateAccountNamePayload) => {
  const {name} = action.payload
  return RPCTypes.localValidateAccountNameLocalRpcPromise({name})
    .then(() => WalletsGen.createValidatedAccountName({name}))
    .catch(err => {
      logger.warn(`Error validating account name: ${err.desc}`)
      return WalletsGen.createValidatedAccountNameError({error: err.desc, name})
    })
}

const validateSecretKey = (state: TypedState, action: WalletsGen.ValidateSecretKeyPayload) => {
  const {secretKey} = action.payload
  return RPCTypes.localValidateSecretKeyLocalRpcPromise({secretKey: secretKey.stringValue()})
    .then(() => WalletsGen.createValidatedSecretKey({secretKey}))
    .catch(err => {
      logger.warn(`Error validating secret key: ${err.desc}`)
      return WalletsGen.createValidatedSecretKeyError({error: err.desc, secretKey})
    })
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

const exportSecretKey = (state: TypedState, action: WalletsGen.ExportSecretKeyPayload) =>
  RPCTypes.localGetWalletAccountSecretKeyLocalRpcPromise({accountID: action.payload.accountID}).then(res =>
    WalletsGen.createSecretKeyReceived({
      accountID: action.payload.accountID,
      secretKey: new HiddenString(res),
    })
  )

const maybeSelectDefaultAccount = (action: WalletsGen.AccountsReceivedPayload, state: TypedState) =>
  state.wallets.get('selectedAccount') === Types.noAccountID &&
  Saga.put(
    WalletsGen.createSelectAccount({
      accountID: state.wallets.accountMap.find(account => account.isDefault).accountID,
    })
  )

function* walletsSaga(): Saga.SagaGenerator<any, any> {
  yield Saga.safeTakeEveryPurePromise(
    [WalletsGen.loadAccounts, WalletsGen.linkedExistingAccount],
    loadAccounts
  )
  yield Saga.safeTakeEveryPurePromise(
    [WalletsGen.loadAssets, WalletsGen.selectAccount, WalletsGen.linkedExistingAccount],
    loadAssets
  )
  yield Saga.safeTakeEveryPurePromise(
    [WalletsGen.loadPayments, WalletsGen.selectAccount, WalletsGen.linkedExistingAccount],
    loadPayments
  )
  yield Saga.safeTakeEveryPurePromise(WalletsGen.loadPaymentDetail, loadPaymentDetail)
  yield Saga.safeTakeEveryPurePromise(WalletsGen.linkExistingAccount, linkExistingAccount)
  yield Saga.safeTakeEveryPurePromise(WalletsGen.validateAccountName, validateAccountName)
  yield Saga.safeTakeEveryPurePromise(WalletsGen.validateSecretKey, validateSecretKey)
  yield Saga.safeTakeEveryPurePromise(WalletsGen.exportSecretKey, exportSecretKey)
  yield Saga.safeTakeEveryPure(
    [WalletsGen.selectAccount, WalletsGen.linkedExistingAccount],
    navigateToAccount
  )
  yield Saga.safeTakeEveryPurePromise(WalletsGen.exportSecretKey, exportSecretKey)
  yield Saga.safeTakeEveryPure(WalletsGen.accountsReceived, maybeSelectDefaultAccount)
}

export default walletsSaga
