// @flow
import * as Constants from '../constants/wallets'
import * as Types from '../constants/types/wallets'
import * as RPCTypes from '../constants/types/rpc-stellar-gen'
import * as Saga from '../util/saga'
import * as WalletsGen from './wallets-gen'
import * as Chat2Gen from './chat2-gen'
import * as ConfigGen from './config-gen'
import HiddenString from '../util/hidden-string'
import * as Route from './route-tree'
import logger from '../logger'
import type {TypedState} from '../constants/reducer'
import {getPath} from '../route-tree'
import {walletsTab} from '../constants/tabs'
import flags from '../util/feature-flags'

const buildPayment = (state: TypedState) =>
  RPCTypes.localBuildPaymentLocalRpcPromise({
    amount: state.wallets.buildingPayment.amount,
    // FIXME: Assumes XLM.
    from: state.wallets.selectedAccount,
    fromSeqno: '',
    publicMemo: state.wallets.buildingPayment.publicMemo.stringValue(),
    secretNote: state.wallets.buildingPayment.secretNote.stringValue(),
    to: state.wallets.buildingPayment.to,
    toIsAccountID: true,
  }).then(build =>
    WalletsGen.createBuiltPaymentReceived({
      build: Constants.buildPaymentResultToBuiltPayment(build),
    })
  )

const createNewAccount = (state: TypedState, action: WalletsGen.CreateNewAccountPayload) => {
  const {name} = action.payload
  return RPCTypes.localCreateWalletAccountLocalRpcPromise(
    {
      name,
    },
    Constants.createNewAccountWaitingKey
  )
    .then(accountIDString => Types.stringToAccountID(accountIDString))
    .then(accountID => WalletsGen.createCreatedNewAccount({accountID}))
    .catch(err => {
      logger.warn(`Error creating new account: ${err.desc}`)
      return WalletsGen.createCreatedNewAccountError({error: err.desc, name})
    })
}

const sendPayment = (state: TypedState) =>
  RPCTypes.localSendPaymentLocalRpcPromise(
    {
      amount: state.wallets.buildingPayment.amount,
      // FIXME -- support other assets.
      asset: {type: 'native', code: '', issuer: ''},
      from: state.wallets.buildingPayment.from,
      fromSeqno: '',
      publicMemo: state.wallets.buildingPayment.publicMemo.stringValue(),
      quickReturn: false,
      secretNote: state.wallets.buildingPayment.secretNote.stringValue(),
      to: state.wallets.buildingPayment.to,
      toIsAccountID: !!state.wallets.builtPayment.toUsername,
      worthAmount: '',
    },
    Constants.sendPaymentWaitingKey
  ).then(res => WalletsGen.createSentPayment({kbTxID: new HiddenString(res.kbTxID)}))

const requestPayment = (state: TypedState) =>
  RPCTypes.localMakeRequestLocalRpcPromise(
    {
      amount: state.wallets.buildingPayment.amount,
      // FIXME -- support other assets.
      asset: {type: 'native', code: '', issuer: ''},
      recipient: state.wallets.buildingPayment.to,
      // TODO -- support currency
      note: state.wallets.buildingPayment.publicMemo.stringValue(),
    },
    Constants.requestPaymentWaitingKey
  ).then(kbRqID => WalletsGen.createRequestedPayment({kbRqID: new HiddenString(kbRqID)}))

const clearBuiltPayment = () => Saga.put(WalletsGen.createClearBuiltPayment())

const clearBuildingPayment = () => Saga.put(WalletsGen.createClearBuildingPayment())

const loadAccounts = (
  state: TypedState,
  action:
    | WalletsGen.LoadAccountsPayload
    | WalletsGen.LinkedExistingAccountPayload
    | WalletsGen.RefreshPaymentsPayload
    | ConfigGen.LoggedInPayload
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
    | WalletsGen.RefreshPaymentsPayload
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
    | WalletsGen.RefreshPaymentsPayload
) =>
  !action.error &&
  Promise.all([
    RPCTypes.localGetPendingPaymentsLocalRpcPromise({accountID: action.payload.accountID}),
    RPCTypes.localGetPaymentsLocalRpcPromise({accountID: action.payload.accountID}),
  ]).then(([pending, payments]) =>
    WalletsGen.createPaymentsReceived({
      accountID: action.payload.accountID,
      payments: (payments.payments || []).map(elem => Constants.paymentResultToPayment(elem)).filter(Boolean),
      pending: (pending || []).map(elem => Constants.paymentResultToPayment(elem)).filter(Boolean),
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
      publicMemo: new HiddenString(res.publicNote),
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

const navigateUp = (
  state: TypedState,
  action: WalletsGen.CreatedNewAccountPayload | WalletsGen.LinkedExistingAccountPayload
) => {
  if (action.type === WalletsGen.createdNewAccount && action.error) {
    // Create new account failed, don't nav
    return
  }
  if (action.type === WalletsGen.linkedExistingAccount && action.error) {
    // Link existing failed, don't nav
    return
  }
  return Saga.put(Route.navigateUp())
}

const navigateToAccount = (action: WalletsGen.SelectAccountPayload) => {
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
  state.wallets.selectedAccount === Types.noAccountID &&
  Saga.put(
    WalletsGen.createSelectAccount({
      accountID: state.wallets.accountMap.find(account => account.isDefault).accountID,
    })
  )

const loadRequestDetail = (state: TypedState, action: WalletsGen.LoadRequestDetailPayload) =>
  RPCTypes.localGetRequestDetailsLocalRpcPromise({reqID: action.payload.requestID})
    .then(request => WalletsGen.createRequestDetailReceived({request}))
    .catch(err => logger.error(`Error loading request detail: ${err.message}`))

const cancelRequest = (state: TypedState, action: WalletsGen.CancelRequestPayload) => {
  const {conversationIDKey, ordinal, requestID} = action.payload
  return RPCTypes.localCancelRequestLocalRpcPromise({reqID: requestID})
    .then(
      () => (conversationIDKey && ordinal ? Chat2Gen.createMessageDelete({conversationIDKey, ordinal}) : null)
    )
    .catch(err => logger.error(`Error cancelling request: ${err.message}`))
}

const maybeNavigateAwayFromSendForm = (state: TypedState, action: WalletsGen.AbandonPaymentPayload) => {
  const routeState = state.routeTree.routeState
  const path = getPath(routeState)
  const lastNode = path.last()
  if (Constants.sendReceiveFormRoutes.includes(lastNode)) {
    if (path.first() === walletsTab) {
      // User is on send form in wallets tab, navigate back to root of tab
      return Saga.put(Route.navigateTo([{props: {}, selected: walletsTab}, {props: {}, selected: null}]))
    }
    // User is somewhere else, send them to most recent parent that isn't a form route
    const firstFormIndex = path.findIndex(node => Constants.sendReceiveFormRoutes.includes(node))
    const pathAboveForm = path.slice(0, firstFormIndex)
    return Saga.put(Route.navigateTo(pathAboveForm))
  }
}

function* walletsSaga(): Saga.SagaGenerator<any, any> {
  if (!flags.walletsEnabled) {
    console.log('Wallets saga disabled')
    return
  }

  yield Saga.actionToPromise(WalletsGen.createNewAccount, createNewAccount)
  yield Saga.actionToPromise(
    [
      WalletsGen.loadAccounts,
      WalletsGen.createdNewAccount,
      WalletsGen.linkedExistingAccount,
      WalletsGen.refreshPayments,
      ConfigGen.loggedIn,
    ],
    loadAccounts
  )
  yield Saga.actionToPromise(
    [
      WalletsGen.loadAssets,
      WalletsGen.refreshPayments,
      WalletsGen.selectAccount,
      WalletsGen.linkedExistingAccount,
    ],
    loadAssets
  )
  yield Saga.actionToPromise(
    [
      WalletsGen.loadPayments,
      WalletsGen.refreshPayments,
      WalletsGen.selectAccount,
      WalletsGen.linkedExistingAccount,
    ],
    loadPayments
  )
  yield Saga.actionToPromise(WalletsGen.loadPaymentDetail, loadPaymentDetail)
  yield Saga.actionToPromise(WalletsGen.linkExistingAccount, linkExistingAccount)
  yield Saga.actionToPromise(WalletsGen.validateAccountName, validateAccountName)
  yield Saga.actionToPromise(WalletsGen.validateSecretKey, validateSecretKey)
  yield Saga.actionToPromise(WalletsGen.exportSecretKey, exportSecretKey)
  yield Saga.safeTakeEveryPure(WalletsGen.selectAccount, navigateToAccount)
  yield Saga.actionToAction([WalletsGen.createdNewAccount, WalletsGen.linkedExistingAccount], navigateUp)

  yield Saga.safeTakeEveryPure(WalletsGen.accountsReceived, maybeSelectDefaultAccount)
  yield Saga.actionToPromise(
    [
      WalletsGen.setBuildingAmount,
      WalletsGen.setBuildingCurrency,
      WalletsGen.setBuildingFrom,
      WalletsGen.setBuildingPublicMemo,
      WalletsGen.setBuildingSecretNote,
      WalletsGen.setBuildingTo,
    ],
    buildPayment
  )
  yield Saga.actionToPromise(WalletsGen.sendPayment, sendPayment)
  yield Saga.actionToAction(WalletsGen.sentPayment, clearBuildingPayment)
  yield Saga.actionToAction(WalletsGen.sentPayment, clearBuiltPayment)
  yield Saga.actionToAction(WalletsGen.sentPayment, maybeNavigateAwayFromSendForm)

  yield Saga.actionToPromise(WalletsGen.requestPayment, requestPayment)
  yield Saga.actionToAction(WalletsGen.requestedPayment, clearBuildingPayment)
  yield Saga.actionToAction(WalletsGen.requestedPayment, clearBuiltPayment)
  yield Saga.actionToAction(WalletsGen.requestedPayment, maybeNavigateAwayFromSendForm)

  // Effects of abandoning payments
  yield Saga.actionToAction(WalletsGen.abandonPayment, clearBuildingPayment)
  yield Saga.actionToAction(WalletsGen.abandonPayment, clearBuiltPayment)
  yield Saga.actionToAction(WalletsGen.abandonPayment, maybeNavigateAwayFromSendForm)

  yield Saga.actionToPromise(WalletsGen.loadRequestDetail, loadRequestDetail)
  yield Saga.actionToPromise(WalletsGen.cancelRequest, cancelRequest)
}

export default walletsSaga
