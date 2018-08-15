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

const buildPayment = (state: TypedState) =>
  RPCTypes.localBuildPaymentLocalRpcPromise({
    amount: state.wallets.get('buildingPayment').get('amount'),
    // FIXME: Assumes XLM.
    from: state.wallets.selectedAccount,
    fromSeqno: '',
    publicMemo: state.wallets.get('buildingPayment').get('publicMemo'),
    secretNote: state.wallets.get('buildingPayment').get('secretNote').stringValue(),
    to: state.wallets.get('buildingPayment').get('to'),
    toIsAccountID: true,
  }).then(build => WalletsGen.createBuiltPaymentReceived({
      build: Constants.buildPaymentResultToBuiltPayment(build),
    })
  )

const sendPayment = (state: TypedState) =>
  RPCTypes.localSendPaymentLocalRpcPromise({
    amount: state.wallets.get('buildingPayment').get('amount'),
    // FIXME -- support other assets.
    asset: {type: 'native', code: '', issuer: ''},
    from: state.wallets.get('buildingPayment').get('from'),
    fromSeqno: '',
    publicMemo: state.wallets.get('buildingPayment').get('publicMemo'),
    quickReturn: false,
    secretNote: state.wallets.get('buildingPayment').get('secretNote').stringValue(),
    to: state.wallets.get('buildingPayment').get('to'),
    toIsAccountID: !!state.wallets.get('builtPayment').get('toUsername'),
    worthAmount: '',
  }, Constants.sendPaymentWaitingKey).then(res =>
    WalletsGen.createClearBuildingPayment()
  ).then(res =>
    WalletsGen.createClearBuiltPayment()
  ).then(res =>
    Route.navigateTo([{props: {}, selected: walletsTab}, {props: {}, selected: null}])
  )

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
  Promise.all([
    RPCTypes.localGetPendingPaymentsLocalRpcPromise({accountID: action.payload.accountID}),
    RPCTypes.localGetPaymentsLocalRpcPromise({accountID: action.payload.accountID}),
  ]).then(([pending, payments]) =>
    WalletsGen.createPaymentsReceived({
      accountID: action.payload.accountID,
      payments: (payments.payments || [])
        .concat(pending || [])
        .map(elem => Constants.paymentResultToPayment(elem))
        .filter(Boolean),
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
      publicMemo: res.publicNote,
      publicMemoType: res.publicNoteType,
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
  yield Saga.actionToPromise([WalletsGen.loadAccounts, WalletsGen.linkedExistingAccount], loadAccounts)
  yield Saga.actionToPromise(
    [WalletsGen.loadAssets, WalletsGen.selectAccount, WalletsGen.linkedExistingAccount],
    loadAssets
  )
  yield Saga.actionToPromise(
    [WalletsGen.loadPayments, WalletsGen.selectAccount, WalletsGen.linkedExistingAccount],
    loadPayments
  )
  yield Saga.actionToPromise(WalletsGen.loadPaymentDetail, loadPaymentDetail)
  yield Saga.actionToPromise(WalletsGen.linkExistingAccount, linkExistingAccount)
  yield Saga.actionToPromise(WalletsGen.validateAccountName, validateAccountName)
  yield Saga.actionToPromise(WalletsGen.validateSecretKey, validateSecretKey)
  yield Saga.actionToPromise(WalletsGen.exportSecretKey, exportSecretKey)
  yield Saga.safeTakeEveryPure(
    [WalletsGen.selectAccount, WalletsGen.linkedExistingAccount],
    navigateToAccount
  )
  yield Saga.safeTakeEveryPure(WalletsGen.accountsReceived, maybeSelectDefaultAccount)
  yield Saga.actionToPromise(WalletsGen.setBuildingAmount, buildPayment)
  yield Saga.actionToPromise(WalletsGen.setBuildingCurrency, buildPayment)
  yield Saga.actionToPromise(WalletsGen.setBuildingFrom, buildPayment)
  yield Saga.actionToPromise(WalletsGen.setBuildingPublicMemo, buildPayment)
  yield Saga.actionToPromise(WalletsGen.setBuildingSecretNote, buildPayment)
  yield Saga.actionToPromise(WalletsGen.setBuildingTo, buildPayment)
  yield Saga.actionToPromise(WalletsGen.sendPayment, sendPayment)
}

export default walletsSaga
