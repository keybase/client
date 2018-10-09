// @flow
import * as Constants from '../constants/wallets'
import * as Types from '../constants/types/wallets'
import * as RPCStellarTypes from '../constants/types/rpc-stellar-gen'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Saga from '../util/saga'
import * as WalletsGen from './wallets-gen'
import * as Chat2Gen from './chat2-gen'
import * as ConfigGen from './config-gen'
import * as NotificationsGen from './notifications-gen'
import * as RouteTreeGen from './route-tree-gen'
import HiddenString from '../util/hidden-string'
import * as Route from './route-tree'
import logger from '../logger'
import type {TypedState} from '../constants/reducer'
import {getPath} from '../route-tree'
import * as Tabs from '../constants/tabs'
import * as SettingsConstants from '../constants/settings'
import flags from '../util/feature-flags'
import {getEngine} from '../engine'
import {anyWaiting} from '../constants/waiting'
import {RPCError} from '../util/errors'
import {isMobile} from '../constants/platform'

const buildPayment = (state: TypedState, action: any) =>
  RPCStellarTypes.localBuildPaymentLocalRpcPromise({
    amount: state.wallets.buildingPayment.amount,
    currency: state.wallets.buildingPayment.currency === 'XLM' ? null : state.wallets.buildingPayment.currency,
    fromPrimaryAccount: state.wallets.buildingPayment.from === Types.noAccountID,
    from: state.wallets.buildingPayment.from === Types.noAccountID ? '' : state.wallets.buildingPayment.from,
    fromSeqno: '',
    isRequest: state.wallets.buildingPayment.isRequest,
    publicMemo: state.wallets.buildingPayment.publicMemo.stringValue(),
    secretNote: state.wallets.buildingPayment.secretNote.stringValue(),
    to: state.wallets.buildingPayment.to,
    toIsAccountID:
      state.wallets.buildingPayment.recipientType !== 'keybaseUser' &&
      !Constants.isFederatedAddress(state.wallets.buildingPayment.to),
  })
    .then(build =>
      WalletsGen.createBuiltPaymentReceived({
        build: Constants.buildPaymentResultToBuiltPayment(build),
        forBuildingPayment: state.wallets.buildingPayment,
      })
    )
    .catch(error => {
      if (error instanceof RPCError && error.code === RPCTypes.constantsStatusCode.sccanceled) {
        // ignore cancellation
      } else {
        throw error
      }
    })

const createNewAccount = (state: TypedState, action: WalletsGen.CreateNewAccountPayload) => {
  const {name} = action.payload
  return RPCStellarTypes.localCreateWalletAccountLocalRpcPromise({name}, Constants.createNewAccountWaitingKey)
    .then(accountIDString => Types.stringToAccountID(accountIDString))
    .then(accountID =>
      WalletsGen.createCreatedNewAccount({
        accountID,
        showOnCreation: action.payload.showOnCreation,
        setBuildingTo: action.payload.setBuildingTo,
      })
    )
    .catch(err => {
      logger.warn(`Error creating new account: ${err.desc}`)
      return WalletsGen.createCreatedNewAccountError({error: err.desc, name})
    })
}

const emptyAsset = {type: 'native', code: '', issuer: '', issuerName: '', verifiedDomain: ''}

const sendPayment = (state: TypedState) =>
  RPCStellarTypes.localSendPaymentLocalRpcPromise(
    {
      amount: state.wallets.buildingPayment.amount,
      // FIXME -- support other assets.
      asset: emptyAsset,
      from: state.wallets.builtPayment.from,
      fromSeqno: '',
      publicMemo: state.wallets.buildingPayment.publicMemo.stringValue(),
      quickReturn: true,
      secretNote: state.wallets.buildingPayment.secretNote.stringValue(),
      to: state.wallets.buildingPayment.to,
      toIsAccountID:
        state.wallets.buildingPayment.recipientType !== 'keybaseUser' &&
        !Constants.isFederatedAddress(state.wallets.buildingPayment.to),
      worthAmount: '',
    },
    Constants.sendPaymentWaitingKey
  )
    .then(res => WalletsGen.createSentPayment({kbTxID: new HiddenString(res.kbTxID)}))
    .catch(err => WalletsGen.createSentPaymentError({error: err.desc}))

const requestPayment = (state: TypedState) =>
  RPCStellarTypes.localMakeRequestLocalRpcPromise(
    {
      amount: state.wallets.buildingPayment.amount,
      // FIXME -- support other assets.
      asset: emptyAsset,
      recipient: state.wallets.buildingPayment.to,
      // TODO -- support currency
      note: state.wallets.buildingPayment.secretNote.stringValue(),
    },
    Constants.requestPaymentWaitingKey
  ).then(kbRqID => WalletsGen.createRequestedPayment({kbRqID: new HiddenString(kbRqID)}))

const clearBuiltPayment = () => Saga.put(WalletsGen.createClearBuiltPayment())

const clearBuildingPayment = () => Saga.put(WalletsGen.createClearBuildingPayment())

const clearErrors = () => Saga.put(WalletsGen.createClearErrors())

const loadAccount = (state: TypedState, action: WalletsGen.BuiltPaymentReceivedPayload) => {
  const {from: _accountID} = action.payload.build
  const accountID = Types.stringToAccountID(_accountID)

  // Don't load the account if we already have a call doing this
  const waitingKey = Constants.loadAccountWaitingKey(accountID)
  if (!Constants.isAccountLoaded(state, accountID) && !anyWaiting(state, waitingKey)) {
    return RPCStellarTypes.localGetWalletAccountLocalRpcPromise({accountID: accountID}, waitingKey).then(
      account => WalletsGen.createAccountsReceived({accounts: [Constants.accountResultToAccount(account)]})
    )
  }
}

const loadAccounts = (
  state: TypedState,
  action:
    | WalletsGen.LoadAccountsPayload
    | WalletsGen.LinkedExistingAccountPayload
    | WalletsGen.RefreshPaymentsPayload
    | WalletsGen.DidSetAccountAsDefaultPayload
    | ConfigGen.LoggedInPayload
) =>
  !action.error &&
  RPCStellarTypes.localGetWalletAccountsLocalRpcPromise().then(res =>
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
  RPCStellarTypes.localGetAccountAssetsLocalRpcPromise({accountID: action.payload.accountID}).then(res =>
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
    RPCStellarTypes.localGetPendingPaymentsLocalRpcPromise({accountID: action.payload.accountID}),
    RPCStellarTypes.localGetPaymentsLocalRpcPromise({accountID: action.payload.accountID}),
  ]).then(([pending, payments]) =>
    WalletsGen.createPaymentsReceived({
      accountID: action.payload.accountID,
      paymentCursor: payments.cursor,
      payments: (payments.payments || [])
        .map(elem => Constants.paymentResultToPayment(elem, 'history', payments.oldestUnread))
        .filter(Boolean),
      pending: (pending || [])
        .map(elem => Constants.paymentResultToPayment(elem, 'pending', payments.oldestUnread))
        .filter(Boolean),
    })
  )

const loadMorePayments = (state: TypedState, action: WalletsGen.LoadMorePaymentsPayload) => {
  const cursor = state.wallets.paymentCursorMap.get(action.payload.accountID)
  return (
    cursor &&
    RPCStellarTypes.localGetPaymentsLocalRpcPromise({accountID: action.payload.accountID, cursor}).then(
      payments =>
        WalletsGen.createPaymentsReceived({
          accountID: action.payload.accountID,
          paymentCursor: payments.cursor,
          payments: (payments.payments || [])
            .map(elem => Constants.paymentResultToPayment(elem, 'history', payments.oldestUnread))
            .filter(Boolean),
          pending: [],
        })
    )
  )
}

const loadDisplayCurrencies = (state: TypedState, action: WalletsGen.LoadDisplayCurrenciesPayload) =>
  RPCStellarTypes.localGetDisplayCurrenciesLocalRpcPromise().then(res =>
    WalletsGen.createDisplayCurrenciesReceived({
      currencies: (res || []).map(c => Constants.currenciesResultToCurrencies(c)),
    })
  )

  const loadSendAssetChoices = (state: TypedState, action: WalletsGen.LoadSendAssetChoicesPayload) =>
  RPCStellarTypes.localGetSendAssetChoicesLocalRpcPromise({
    from: action.payload.from,
    to: action.payload.to,
  }).then(res => {
    res && WalletsGen.createSendAssetChoicesReceived({sendAssetChoices: res})
  })

const loadDisplayCurrency = (state: TypedState, action: WalletsGen.LoadDisplayCurrencyPayload) =>
  RPCStellarTypes.localGetDisplayCurrencyLocalRpcPromise({
    accountID: action.payload.accountID,
  }).then(res =>
    WalletsGen.createDisplayCurrencyReceived({
      accountID: action.payload.accountID,
      currency: Constants.makeCurrencies(res),
    })
  )

const changeDisplayCurrency = (state: TypedState, action: WalletsGen.ChangeDisplayCurrencyPayload) =>
  RPCStellarTypes.localChangeDisplayCurrencyLocalRpcPromise(
    {
      accountID: action.payload.accountID,
      currency: action.payload.code, // called currency, though it is a code
    },
    Constants.changeDisplayCurrencyWaitingKey
  ).then(res => WalletsGen.createLoadDisplayCurrency({accountID: action.payload.accountID}))

const changeAccountName = (state: TypedState, action: WalletsGen.ChangeAccountNamePayload) =>
  RPCStellarTypes.localChangeWalletAccountNameLocalRpcPromise(
    {
      accountID: action.payload.accountID,
      newName: action.payload.name,
    },
    Constants.changeAccountNameWaitingKey
  ).then(res => WalletsGen.createChangedAccountName({accountID: action.payload.accountID}))

const deleteAccount = (state: TypedState, action: WalletsGen.DeleteAccountPayload) =>
  RPCStellarTypes.localDeleteWalletAccountLocalRpcPromise(
    {
      accountID: action.payload.accountID,
      userAcknowledged: 'yes',
    },
    Constants.deleteAccountWaitingKey
  ).then(res => WalletsGen.createDeletedAccount())

const setAccountAsDefault = (state: TypedState, action: WalletsGen.SetAccountAsDefaultPayload) =>
  RPCStellarTypes.localSetWalletAccountAsDefaultLocalRpcPromise(
    {
      accountID: action.payload.accountID,
    },
    Constants.setAccountAsDefaultWaitingKey
  ).then(res => WalletsGen.createDidSetAccountAsDefault({accountID: action.payload.accountID}))

const loadPaymentDetail = (state: TypedState, action: WalletsGen.LoadPaymentDetailPayload) =>
  RPCStellarTypes.localGetPaymentDetailsLocalRpcPromise({
    accountID: action.payload.accountID,
    id: Types.paymentIDToRPCPaymentID(action.payload.paymentID),
  }).then(res =>
    WalletsGen.createPaymentDetailReceived({
      accountID: action.payload.accountID,
      payment: Constants.paymentDetailResultToPayment(res),
    })
  )

const markAsRead = (state: TypedState, action: WalletsGen.MarkAsReadPayload) =>
  RPCStellarTypes.localMarkAsReadLocalRpcPromise({
    accountID: action.payload.accountID,
    mostRecentID: Types.paymentIDToRPCPaymentID(action.payload.mostRecentID),
  })

const linkExistingAccount = (state: TypedState, action: WalletsGen.LinkExistingAccountPayload) => {
  const {name, secretKey} = action.payload
  return RPCStellarTypes.localLinkNewWalletAccountLocalRpcPromise(
    {
      name,
      secretKey: secretKey.stringValue(),
    },
    Constants.linkExistingWaitingKey
  )
    .then(accountIDString => Types.stringToAccountID(accountIDString))
    .then(accountID =>
      WalletsGen.createLinkedExistingAccount({
        accountID,
        showOnCreation: action.payload.showOnCreation,
        setBuildingTo: action.payload.setBuildingTo,
      })
    )
    .catch(err => {
      logger.warn(`Error linking existing account: ${err.desc}`)
      return WalletsGen.createLinkedExistingAccountError({error: err.desc, name, secretKey})
    })
}

const validateAccountName = (state: TypedState, action: WalletsGen.ValidateAccountNamePayload) => {
  const {name} = action.payload
  return RPCStellarTypes.localValidateAccountNameLocalRpcPromise({name})
    .then(() => WalletsGen.createValidatedAccountName({name}))
    .catch(err => {
      logger.warn(`Error validating account name: ${err.desc}`)
      return WalletsGen.createValidatedAccountNameError({error: err.desc, name})
    })
}

const validateSecretKey = (state: TypedState, action: WalletsGen.ValidateSecretKeyPayload) => {
  const {secretKey} = action.payload
  return RPCStellarTypes.localValidateSecretKeyLocalRpcPromise({secretKey: secretKey.stringValue()})
    .then(() => WalletsGen.createValidatedSecretKey({secretKey}))
    .catch(err => {
      logger.warn(`Error validating secret key: ${err.desc}`)
      return WalletsGen.createValidatedSecretKeyError({error: err.desc, secretKey})
    })
}

const deletedAccount = (state: TypedState) =>
  Saga.put(
    WalletsGen.createSelectAccount({
      accountID: state.wallets.accountMap.find(account => account.isDefault).accountID,
      show: true,
    })
  )

const createdOrLinkedAccount = (
  state: TypedState,
  action: WalletsGen.CreatedNewAccountPayload | WalletsGen.LinkedExistingAccountPayload
) => {
  if (action.error) {
    // Create new account failed, don't nav
    return
  }
  if (action.payload.showOnCreation) {
    return Saga.put(WalletsGen.createSelectAccount({accountID: action.payload.accountID, show: true}))
  }
  if (action.payload.setBuildingTo) {
    return Saga.put(WalletsGen.createSetBuildingTo({to: action.payload.accountID}))
  }
  return Saga.put(Route.navigateUp())
}

const navigateUp = (
  state: TypedState,
  action: WalletsGen.DidSetAccountAsDefaultPayload | WalletsGen.ChangedAccountNamePayload
) => {
  if (action.error) {
    // we don't want to nav on error
    return
  }
  return Saga.put(Route.navigateUp())
}

const navigateToAccount = (state: TypedState, action: WalletsGen.SelectAccountPayload) => {
  if (action.type === WalletsGen.selectAccount && !action.payload.show) {
    // we don't want to show, don't nav
    return
  }
  const wallet = isMobile
    ? [Tabs.settingsTab, SettingsConstants.walletsTab, 'wallet']
    : [{props: {}, selected: Tabs.walletsTab}, {props: {}, selected: null}]

  return Saga.put(Route.navigateTo(wallet))
}

const exportSecretKey = (state: TypedState, action: WalletsGen.ExportSecretKeyPayload) =>
  RPCStellarTypes.localGetWalletAccountSecretKeyLocalRpcPromise({accountID: action.payload.accountID}).then(
    res =>
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
  RPCStellarTypes.localGetRequestDetailsLocalRpcPromise({reqID: action.payload.requestID})
    .then(request => WalletsGen.createRequestDetailReceived({request}))
    .catch(err => logger.error(`Error loading request detail: ${err.message}`))

const cancelPayment = (state: TypedState, action: WalletsGen.CancelPaymentPayload) => {
  const {paymentID} = action.payload
  const pid = Types.paymentIDToString(paymentID)
  logger.info(`cancelPayment: cancelling payment with ID ${pid}`)
  return RPCStellarTypes.localCancelPaymentLocalRpcPromise(
    {paymentID: Types.paymentIDToRPCPaymentID(action.payload.paymentID)},
    Constants.cancelPaymentWaitingKey(action.payload.paymentID)
  )
    .then(_ => {
      logger.info(`cancelPayment: successfully cancelled payment with ID ${pid}`)
      return WalletsGen.createSelectAccount({accountID: Constants.getSelectedAccount(state), show: true})
    })
    .catch(err => {
      logger.error(`cancelPayment: failed to cancel payment with ID ${pid}. Error: ${err.message}`)
      throw err
    })
}

const cancelRequest = (state: TypedState, action: WalletsGen.CancelRequestPayload) => {
  const {conversationIDKey, ordinal, requestID} = action.payload
  return RPCStellarTypes.localCancelRequestLocalRpcPromise({reqID: requestID})
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
    if (path.first() === Tabs.walletsTab) {
      // User is on send form in wallets tab, navigate back to root of tab
      return Saga.put(Route.navigateTo([{props: {}, selected: Tabs.walletsTab}, {props: {}, selected: null}]))
    }
    // User is somewhere else, send them to most recent parent that isn't a form route
    const firstFormIndex = path.findIndex(node => Constants.sendReceiveFormRoutes.includes(node))
    const pathAboveForm = path.slice(0, firstFormIndex)
    return Saga.put(Route.navigateTo(pathAboveForm))
  }
}

const setupEngineListeners = () => {
  getEngine().setIncomingCallMap({
    'stellar.1.notify.paymentNotification': refreshPayments,
    'stellar.1.notify.paymentStatusNotification': refreshPayments,
  })
}

const refreshPayments = ({accountID}) =>
  Saga.put(WalletsGen.createRefreshPayments({accountID: Types.stringToAccountID(accountID)}))

const maybeClearErrors = (state: TypedState) => {
  const routePath = getPath(state.routeTree.routeState)
  const selectedTab = routePath.first()
  if (selectedTab === Tabs.walletsTab) {
    return Saga.put(WalletsGen.createClearErrors())
  }
}

const receivedBadgeState = (state: TypedState, action: NotificationsGen.ReceivedBadgeStatePayload) =>
  Saga.put(WalletsGen.createBadgesUpdated({accounts: action.payload.badgeState.unreadWalletAccounts || []}))

function* walletsSaga(): Saga.SagaGenerator<any, any> {
  if (!flags.walletsEnabled) {
    console.log('Wallets saga disabled')
    return
  }

  yield Saga.actionToPromise(WalletsGen.createNewAccount, createNewAccount)
  yield Saga.actionToPromise(WalletsGen.builtPaymentReceived, loadAccount)
  yield Saga.actionToPromise(
    [
      WalletsGen.loadAccounts,
      WalletsGen.createdNewAccount,
      WalletsGen.linkedExistingAccount,
      WalletsGen.refreshPayments,
      WalletsGen.didSetAccountAsDefault,
      WalletsGen.changedAccountName,
      WalletsGen.deletedAccount,
    ],
    loadAccounts
  )
  yield Saga.actionToPromise(
    [
      WalletsGen.loadAssets,
      WalletsGen.refreshPayments,
      WalletsGen.selectAccount,
      WalletsGen.linkedExistingAccount,
      WalletsGen.loadDisplayCurrency,
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
  yield Saga.actionToPromise(WalletsGen.loadMorePayments, loadMorePayments)
  yield Saga.actionToPromise(WalletsGen.deleteAccount, deleteAccount)
  yield Saga.actionToPromise(WalletsGen.loadPaymentDetail, loadPaymentDetail)
  yield Saga.actionToPromise(WalletsGen.markAsRead, markAsRead)
  yield Saga.actionToPromise(WalletsGen.linkExistingAccount, linkExistingAccount)
  yield Saga.actionToPromise(WalletsGen.validateAccountName, validateAccountName)
  yield Saga.actionToPromise(WalletsGen.validateSecretKey, validateSecretKey)
  yield Saga.actionToPromise(WalletsGen.exportSecretKey, exportSecretKey)
  yield Saga.actionToPromise(WalletsGen.loadDisplayCurrencies, loadDisplayCurrencies)
  yield Saga.actionToPromise(WalletsGen.loadSendAssetChoices, loadSendAssetChoices)
  yield Saga.actionToPromise(WalletsGen.loadDisplayCurrency, loadDisplayCurrency)
  yield Saga.actionToPromise(WalletsGen.changeDisplayCurrency, changeDisplayCurrency)
  yield Saga.actionToPromise(WalletsGen.setAccountAsDefault, setAccountAsDefault)
  yield Saga.actionToPromise(WalletsGen.changeAccountName, changeAccountName)
  yield Saga.actionToAction(WalletsGen.selectAccount, navigateToAccount)
  yield Saga.actionToAction([WalletsGen.didSetAccountAsDefault, WalletsGen.changedAccountName], navigateUp)
  yield Saga.actionToAction(
    [WalletsGen.createdNewAccount, WalletsGen.linkedExistingAccount],
    createdOrLinkedAccount
  )
  yield Saga.safeTakeEveryPure(WalletsGen.accountsReceived, maybeSelectDefaultAccount)
  yield Saga.actionToPromise(
    [
      WalletsGen.setBuildingAmount,
      WalletsGen.setBuildingCurrency,
      WalletsGen.setBuildingFrom,
      WalletsGen.setBuildingIsRequest,
      WalletsGen.setBuildingPublicMemo,
      WalletsGen.setBuildingSecretNote,
      WalletsGen.setBuildingTo,
    ],
    buildPayment
  )

  yield Saga.actionToAction(WalletsGen.deletedAccount, deletedAccount)

  yield Saga.actionToPromise(WalletsGen.sendPayment, sendPayment)
  yield Saga.actionToAction(WalletsGen.sentPayment, clearBuildingPayment)
  yield Saga.actionToAction(WalletsGen.sentPayment, clearBuiltPayment)
  yield Saga.actionToAction(WalletsGen.sentPayment, clearErrors)

  yield Saga.actionToAction(WalletsGen.sentPayment, maybeNavigateAwayFromSendForm)

  yield Saga.actionToPromise(WalletsGen.requestPayment, requestPayment)
  yield Saga.actionToAction(WalletsGen.requestedPayment, clearBuildingPayment)
  yield Saga.actionToAction(WalletsGen.requestedPayment, clearBuiltPayment)
  yield Saga.actionToAction(WalletsGen.requestedPayment, maybeNavigateAwayFromSendForm)

  // Effects of abandoning payments
  yield Saga.actionToAction(WalletsGen.abandonPayment, clearBuildingPayment)
  yield Saga.actionToAction(WalletsGen.abandonPayment, clearBuiltPayment)
  yield Saga.actionToAction(WalletsGen.abandonPayment, clearErrors)
  yield Saga.actionToAction(WalletsGen.abandonPayment, maybeNavigateAwayFromSendForm)

  yield Saga.actionToPromise(WalletsGen.loadRequestDetail, loadRequestDetail)
  yield Saga.actionToPromise(WalletsGen.cancelRequest, cancelRequest)
  yield Saga.actionToPromise(WalletsGen.cancelPayment, cancelPayment)

  yield Saga.actionToAction(ConfigGen.setupEngineListeners, setupEngineListeners)

  // Clear some errors on navigateUp.
  yield Saga.actionToAction(RouteTreeGen.navigateUp, maybeClearErrors)

  yield Saga.actionToAction(NotificationsGen.receivedBadgeState, receivedBadgeState)
}

export default walletsSaga
