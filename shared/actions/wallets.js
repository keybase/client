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
import * as I from 'immutable'
import flags from '../util/feature-flags'
import {getEngine} from '../engine'
import {anyWaiting} from '../constants/waiting'
import {RPCError} from '../util/errors'
import {isMobile} from '../constants/platform'
import {actionHasError} from '../util/container'

const buildPayment = (
  state: TypedState,
  action:
    | WalletsGen.BuildPaymentPayload
    | WalletsGen.SetBuildingAmountPayload
    | WalletsGen.SetBuildingCurrencyPayload
    | WalletsGen.SetBuildingFromPayload
    | WalletsGen.SetBuildingIsRequestPayload
    | WalletsGen.SetBuildingToPayload
    | WalletsGen.DisplayCurrencyReceivedPayload
) => {
  if (action.type === WalletsGen.displayCurrencyReceived && !action.payload.setBuildingCurrency) {
    // didn't change state.building; no need to call build
    return
  }
  return (state.wallets.building.isRequest
    ? RPCStellarTypes.localBuildRequestLocalRpcPromise(
        {
          amount: state.wallets.building.amount,
          currency: state.wallets.building.currency === 'XLM' ? null : state.wallets.building.currency,
          secretNote: state.wallets.building.secretNote.stringValue(),
          to: state.wallets.building.to,
        },
        Constants.buildPaymentWaitingKey
      ).then(build =>
        WalletsGen.createBuiltRequestReceived({
          build: Constants.buildRequestResultToBuiltRequest(build),
          forBuilding: state.wallets.building,
        })
      )
    : RPCStellarTypes.localBuildPaymentLocalRpcPromise(
        {
          amount: state.wallets.building.amount,
          currency: state.wallets.building.currency === 'XLM' ? null : state.wallets.building.currency,
          fromPrimaryAccount: state.wallets.building.from === Types.noAccountID,
          from: state.wallets.building.from === Types.noAccountID ? '' : state.wallets.building.from,
          publicMemo: state.wallets.building.publicMemo.stringValue(),
          secretNote: state.wallets.building.secretNote.stringValue(),
          to: state.wallets.building.to,
          toIsAccountID:
            state.wallets.building.recipientType !== 'keybaseUser' &&
            !Constants.isFederatedAddress(state.wallets.building.to),
        },
        Constants.buildPaymentWaitingKey
      ).then(build =>
        WalletsGen.createBuiltPaymentReceived({
          build: Constants.buildPaymentResultToBuiltPayment(build),
          forBuilding: state.wallets.building,
        })
      )
  ).catch(error => {
    if (error instanceof RPCError && error.code === RPCTypes.constantsStatusCode.sccanceled) {
      // ignore cancellation
    } else {
      throw error
    }
  })
}

const openSendRequestForm = (state: TypedState, action: WalletsGen.OpenSendRequestFormPayload) =>
  state.wallets.acceptedDisclaimer
    ? Saga.sequentially(
        [
          WalletsGen.createClearBuilding(),
          action.payload.isRequest
            ? WalletsGen.createClearBuiltRequest()
            : WalletsGen.createClearBuiltPayment(),
          WalletsGen.createSetBuildingAmount({amount: action.payload.amount || ''}),
          WalletsGen.createSetBuildingCurrency({
            currency:
              action.payload.currency ||
              (action.payload.from && Constants.getDisplayCurrency(state, action.payload.from).code) ||
              'XLM',
          }),
          WalletsGen.createLoadDisplayCurrency({
            // in case from account differs
            accountID: action.payload.from || Types.noAccountID,
            setBuildingCurrency: !action.payload.currency,
          }),
          WalletsGen.createLoadDisplayCurrencies(),
          WalletsGen.createSetBuildingFrom({from: action.payload.from || Types.noAccountID}),
          WalletsGen.createSetBuildingIsRequest({isRequest: !!action.payload.isRequest}),
          WalletsGen.createSetBuildingPublicMemo({
            publicMemo: action.payload.publicMemo || new HiddenString(''),
          }),
          WalletsGen.createSetBuildingRecipientType({
            recipientType: action.payload.recipientType || 'keybaseUser',
          }),
          WalletsGen.createSetBuildingSecretNote({
            secretNote: action.payload.secretNote || new HiddenString(''),
          }),
          WalletsGen.createSetBuildingTo({to: action.payload.to || ''}),
          RouteTreeGen.createNavigateAppend({
            path: [Constants.sendReceiveFormRouteKey],
          }),
        ].map(a => Saga.put(a))
      )
    : Saga.put(
        isMobile
          ? Route.navigateTo([Tabs.settingsTab, SettingsConstants.walletsTab])
          : Route.switchTo([Tabs.walletsTab])
      )

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

const sendPayment = (state: TypedState) => {
  const notXLM = state.wallets.building.currency !== '' && state.wallets.building.currency !== 'XLM'
  return RPCStellarTypes.localSendPaymentLocalRpcPromise(
    {
      amount: notXLM ? state.wallets.builtPayment.worthAmount : state.wallets.building.amount,
      // FIXME -- support other assets.
      asset: emptyAsset,
      from: state.wallets.builtPayment.from,
      publicMemo: state.wallets.building.publicMemo.stringValue(),
      quickReturn: true,
      secretNote: state.wallets.building.secretNote.stringValue(),
      to: state.wallets.building.to,
      toIsAccountID:
        state.wallets.building.recipientType !== 'keybaseUser' &&
        !Constants.isFederatedAddress(state.wallets.building.to),
      worthAmount: notXLM ? state.wallets.building.amount : state.wallets.builtPayment.worthAmount,
      worthCurrency: state.wallets.builtPayment.worthCurrency,
    },
    Constants.sendPaymentWaitingKey
  )
    .then(res =>
      WalletsGen.createSentPayment({
        kbTxID: new HiddenString(res.kbTxID),
        lastSentXLM: !notXLM,
      })
    )
    .catch(err => WalletsGen.createSentPaymentError({error: err.desc}))
}

const setLastSentXLM = (
  state: TypedState,
  action: WalletsGen.SentPaymentPayload | WalletsGen.RequestedPaymentPayload
) =>
  Saga.put(
    WalletsGen.createSetLastSentXLM({
      lastSentXLM: action.payload.lastSentXLM,
      writeFile: true,
    })
  )

const requestPayment = (state: TypedState) =>
  RPCStellarTypes.localMakeRequestLocalRpcPromise(
    {
      amount: state.wallets.building.amount,
      // FIXME -- support other assets.
      asset: state.wallets.building.currency === 'XLM' ? emptyAsset : undefined,
      currency:
        state.wallets.building.currency && state.wallets.building.currency !== 'XLM'
          ? state.wallets.building.currency
          : undefined,
      recipient: state.wallets.building.to,
      note: state.wallets.building.secretNote.stringValue(),
    },
    Constants.requestPaymentWaitingKey
  ).then(kbRqID =>
    WalletsGen.createRequestedPayment({
      kbRqID: new HiddenString(kbRqID),
      lastSentXLM: state.wallets.building.currency === 'XLM',
      requestee: state.wallets.building.to,
    })
  )

const clearBuiltPayment = () => Saga.put(WalletsGen.createClearBuiltPayment())
const clearBuiltRequest = () => Saga.put(WalletsGen.createClearBuiltRequest())

const clearBuilding = () => Saga.put(WalletsGen.createClearBuilding())

const clearErrors = () => Saga.put(WalletsGen.createClearErrors())

const loadWalletDisclaimer = () =>
  RPCStellarTypes.localHasAcceptedDisclaimerLocalRpcPromise().then(accepted =>
    WalletsGen.createWalletDisclaimerReceived({accepted})
  )

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
  !actionHasError(action) &&
  RPCStellarTypes.localGetWalletAccountsLocalRpcPromise().then(res => {
    return WalletsGen.createAccountsReceived({
      accounts: (res || []).map(account => Constants.accountResultToAccount(account)),
    })
  })

const loadAssets = (
  state: TypedState,
  action:
    | WalletsGen.LoadAssetsPayload
    | WalletsGen.SelectAccountPayload
    | WalletsGen.LinkedExistingAccountPayload
    | WalletsGen.RefreshPaymentsPayload
) =>
  !actionHasError(action) &&
  (action.type === WalletsGen.selectAccount ||
    Constants.getAccount(state, action.payload.accountID).accountID !== Types.noAccountID) &&
  RPCStellarTypes.localGetAccountAssetsLocalRpcPromise({accountID: action.payload.accountID}).then(res =>
    WalletsGen.createAssetsReceived({
      accountID: action.payload.accountID,
      assets: (res || []).map(assets => Constants.assetsResultToAssets(assets)),
    })
  )

const createPaymentsReceived = (accountID, payments, pending) =>
  WalletsGen.createPaymentsReceived({
    accountID,
    oldestUnread: payments.oldestUnread
      ? Types.rpcPaymentIDToPaymentID(payments.oldestUnread)
      : Types.noPaymentID,
    paymentCursor: payments.cursor,
    payments: (payments.payments || [])
      .map(elem => Constants.rpcPaymentResultToPaymentResult(elem, 'history'))
      .filter(Boolean),
    pending: (pending || [])
      .map(elem => Constants.rpcPaymentResultToPaymentResult(elem, 'pending'))
      .filter(Boolean),
  })

const loadPayments = (
  state: TypedState,
  action:
    | WalletsGen.LoadPaymentsPayload
    | WalletsGen.SelectAccountPayload
    | WalletsGen.LinkedExistingAccountPayload
) =>
  !actionHasError(action) &&
  (action.type === WalletsGen.selectAccount ||
    Constants.getAccount(state, action.payload.accountID).accountID !== Types.noAccountID) &&
  Promise.all([
    RPCStellarTypes.localGetPendingPaymentsLocalRpcPromise({accountID: action.payload.accountID}),
    RPCStellarTypes.localGetPaymentsLocalRpcPromise({accountID: action.payload.accountID}),
  ]).then(([pending, payments]) => createPaymentsReceived(action.payload.accountID, payments, pending))

// Fetch all payments for now, but in the future we may want to just
// fetch the single payment.
const doRefreshPayments = (state: TypedState, action: WalletsGen.RefreshPaymentsPayload) =>
  !actionHasError(action) &&
  Constants.getAccount(state, action.payload.accountID).accountID !== Types.noAccountID &&
  Promise.all([
    RPCStellarTypes.localGetPendingPaymentsLocalRpcPromise({accountID: action.payload.accountID}),
    RPCStellarTypes.localGetPaymentsLocalRpcPromise({accountID: action.payload.accountID}),
  ]).then(([pending, payments]) => {
    const {accountID, paymentID} = action.payload
    const paymentsReceived = createPaymentsReceived(action.payload.accountID, payments, pending)
    const found =
      paymentsReceived.payload.payments.find(elem => elem.id === paymentID) ||
      paymentsReceived.payload.pending.find(elem => elem.id === paymentID)
    if (!found) {
      logger.warn(
        `refreshPayments could not find payment for accountID=${accountID} paymentID=${Types.paymentIDToString(
          paymentID
        )}`
      )
    }
    return paymentsReceived
  })

const loadMorePayments = (state: TypedState, action: WalletsGen.LoadMorePaymentsPayload) => {
  const cursor = state.wallets.paymentCursorMap.get(action.payload.accountID)
  return (
    cursor &&
    RPCStellarTypes.localGetPaymentsLocalRpcPromise({accountID: action.payload.accountID, cursor}).then(
      payments => createPaymentsReceived(action.payload.accountID, payments, [])
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

const loadDisplayCurrency = (state: TypedState, action: WalletsGen.LoadDisplayCurrencyPayload) => {
  let accountID = action.payload.accountID
  if (accountID && !Types.isValidAccountID(accountID)) {
    accountID = null
  }
  return RPCStellarTypes.localGetDisplayCurrencyLocalRpcPromise(
    {
      accountID: accountID,
    },
    Constants.getDisplayCurrencyWaitingKey(accountID || Types.noAccountID)
  ).then(res =>
    WalletsGen.createDisplayCurrencyReceived({
      accountID: accountID,
      currency: Constants.makeCurrencies(res),
      setBuildingCurrency: action.payload.setBuildingCurrency,
    })
  )
}

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
      payment: Constants.rpcPaymentDetailToPaymentDetail(res),
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
  return RPCStellarTypes.localValidateAccountNameLocalRpcPromise(
    {name},
    Constants.validateAccountNameWaitingKey
  )
    .then(() => WalletsGen.createValidatedAccountName({name}))
    .catch(err => {
      logger.warn(`Error validating account name: ${err.desc}`)
      return WalletsGen.createValidatedAccountNameError({error: err.desc, name})
    })
}

const validateSecretKey = (state: TypedState, action: WalletsGen.ValidateSecretKeyPayload) => {
  const {secretKey} = action.payload
  return RPCStellarTypes.localValidateSecretKeyLocalRpcPromise(
    {secretKey: secretKey.stringValue()},
    Constants.validateSecretKeyWaitingKey
  )
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
  if (actionHasError(action)) {
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
  if (actionHasError(action)) {
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

const loadDisplayCurrencyForAccounts = (action: WalletsGen.AccountsReceivedPayload, state: TypedState) =>
  // load the display currency of each wallet, now that we have the IDs
  action.payload.accounts.map(account =>
    Saga.put(WalletsGen.createLoadDisplayCurrency({accountID: account.accountID}))
  )

const loadRequestDetail = (state: TypedState, action: WalletsGen.LoadRequestDetailPayload) =>
  RPCStellarTypes.localGetRequestDetailsLocalRpcPromise({reqID: action.payload.requestID})
    .then(request => WalletsGen.createRequestDetailReceived({request}))
    .catch(err => logger.error(`Error loading request detail: ${err.message}`))

const cancelPayment = (state: TypedState, action: WalletsGen.CancelPaymentPayload) => {
  const {paymentID, showAccount} = action.payload
  const pid = Types.paymentIDToString(paymentID)
  logger.info(`cancelPayment: cancelling payment with ID ${pid}`)
  return RPCStellarTypes.localCancelPaymentLocalRpcPromise(
    {paymentID: Types.paymentIDToRPCPaymentID(paymentID)},
    Constants.cancelPaymentWaitingKey(paymentID)
  )
    .then(_ => {
      logger.info(`cancelPayment: successfully cancelled payment with ID ${pid}`)
      if (showAccount) {
        return WalletsGen.createSelectAccount({accountID: Constants.getSelectedAccount(state), show: true})
      }
    })
    .catch(err => {
      logger.error(`cancelPayment: failed to cancel payment with ID ${pid}. Error: ${err.message}`)
      throw err
    })
}

const cancelRequest = (state: TypedState, action: WalletsGen.CancelRequestPayload) => {
  const {conversationIDKey, ordinal, requestID} = action.payload
  return RPCStellarTypes.localCancelRequestLocalRpcPromise({reqID: requestID})
    .then(() =>
      conversationIDKey && ordinal ? Chat2Gen.createMessageDelete({conversationIDKey, ordinal}) : null
    )
    .catch(err => logger.error(`Error cancelling request: ${err.message}`))
}

const maybeNavigateAwayFromSendForm = (state: TypedState, _) => {
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

const maybeNavigateToConversation = (state: TypedState, action: WalletsGen.RequestedPaymentPayload) => {
  // nav to previewed conversation if we aren't already on the chat tab
  const routeState = state.routeTree.routeState
  const path = getPath(routeState)
  if (path.first() === Tabs.chatTab) {
    return maybeNavigateAwayFromSendForm(state, action)
  }
  // not on chat tab; preview
  logger.info('Navigating to conversation because we requested a payment')
  return Saga.put(
    Chat2Gen.createPreviewConversation({participants: [action.payload.requestee], reason: 'requestedPayment'})
  )
}

const setupEngineListeners = () => {
  getEngine().setIncomingCallMap({
    'stellar.1.notify.paymentNotification': refreshPayments,
    'stellar.1.notify.paymentStatusNotification': refreshPayments,
  })
}

const refreshPayments = response => {
  const accountID = Types.stringToAccountID(response.accountID)
  const paymentID = Types.rpcPaymentIDToPaymentID(response.paymentID)
  return Saga.all([
    Saga.put(
      WalletsGen.createRefreshPayments({
        accountID,
        paymentID,
      })
    ),
    Saga.put(WalletsGen.createAddNewPayment({accountID, paymentID})),
  ])
}

const maybeClearErrors = (state: TypedState) => {
  const routePath = getPath(state.routeTree.routeState)
  const selectedTab = routePath.first()
  if (selectedTab === Tabs.walletsTab) {
    return Saga.put(WalletsGen.createClearErrors())
  }
}

const maybeClearNewTxs = (action: RouteTreeGen.SwitchToPayload, state: TypedState) => {
  const rootTab = I.List(action.payload.path).first()
  // If we're leaving from the Wallets tab, and the Wallets tab route
  // was the main transaction list for an account, clear new txs.
  // FIXME: The hardcoded routes here are fragile if routes change.
  if (rootTab !== Constants.rootWalletTab && Constants.isLookingAtWallet(state.routeTree.routeState)) {
    const accountID = state.wallets.selectedAccount
    if (accountID !== Types.noAccountID) {
      return Saga.put(WalletsGen.createClearNewPayments({accountID}))
    }
  }
}

const receivedBadgeState = (state: TypedState, action: NotificationsGen.ReceivedBadgeStatePayload) =>
  Saga.put(WalletsGen.createBadgesUpdated({accounts: action.payload.badgeState.unreadWalletAccounts || []}))

const acceptDisclaimer = (state: TypedState, action: WalletsGen.AcceptDisclaimerPayload) =>
  RPCStellarTypes.localAcceptDisclaimerLocalRpcPromise(undefined, Constants.acceptDisclaimerWaitingKey).then(
    res =>
      RPCStellarTypes.localHasAcceptedDisclaimerLocalRpcPromise().then(accepted =>
        WalletsGen.createWalletDisclaimerReceived({accepted})
      )
  )

const maybeNavToLinkExisting = (state: TypedState, action: WalletsGen.AcceptDisclaimerPayload) =>
  action.payload.nextScreen === 'linkExisting' &&
  Saga.put(Route.navigateTo([...Constants.rootWalletPath, 'linkExisting']))

const rejectDisclaimer = (state: TypedState, action: WalletsGen.AcceptDisclaimerPayload) =>
  Saga.put(
    isMobile
      ? Route.navigateTo([{props: {}, selected: Tabs.settingsTab}, {props: {}, selected: null}])
      : Route.switchTo([state.routeTree.get('previousTab') || Tabs.peopleTab])
  )

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
    ],
    loadAssets
  )
  yield Saga.actionToPromise(
    [WalletsGen.loadPayments, WalletsGen.selectAccount, WalletsGen.linkedExistingAccount],
    loadPayments
  )
  yield Saga.actionToPromise(WalletsGen.refreshPayments, doRefreshPayments)
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
  yield Saga.safeTakeEveryPure(WalletsGen.accountsReceived, loadDisplayCurrencyForAccounts)

  // We don't call this for publicMemo/secretNote so the button doesn't
  // spinner as you type
  yield Saga.actionToPromise(
    [
      WalletsGen.buildPayment,
      WalletsGen.setBuildingAmount,
      WalletsGen.setBuildingCurrency,
      WalletsGen.setBuildingFrom,
      WalletsGen.setBuildingIsRequest,
      WalletsGen.setBuildingTo,
      WalletsGen.displayCurrencyReceived,
    ],
    buildPayment
  )
  yield Saga.actionToAction(WalletsGen.openSendRequestForm, openSendRequestForm)

  yield Saga.actionToAction(WalletsGen.deletedAccount, deletedAccount)

  yield Saga.actionToPromise(WalletsGen.sendPayment, sendPayment)
  yield Saga.actionToAction([WalletsGen.sentPayment, WalletsGen.requestedPayment], setLastSentXLM)
  yield Saga.actionToAction(WalletsGen.sentPayment, clearBuilding)
  yield Saga.actionToAction(WalletsGen.sentPayment, clearBuiltPayment)
  yield Saga.actionToAction(WalletsGen.sentPayment, clearErrors)

  yield Saga.actionToAction(WalletsGen.sentPayment, maybeNavigateAwayFromSendForm)

  yield Saga.actionToPromise(WalletsGen.requestPayment, requestPayment)
  yield Saga.actionToAction(WalletsGen.requestedPayment, clearBuilding)
  yield Saga.actionToAction(WalletsGen.requestedPayment, clearBuiltRequest)
  yield Saga.actionToAction(WalletsGen.requestedPayment, maybeNavigateToConversation)

  // Effects of abandoning payments
  yield Saga.actionToAction(WalletsGen.abandonPayment, clearBuilding)
  yield Saga.actionToAction(WalletsGen.abandonPayment, clearBuiltRequest)
  yield Saga.actionToAction(WalletsGen.abandonPayment, clearErrors)
  yield Saga.actionToAction(WalletsGen.abandonPayment, maybeNavigateAwayFromSendForm)

  yield Saga.actionToPromise(WalletsGen.loadRequestDetail, loadRequestDetail)
  yield Saga.actionToPromise(WalletsGen.cancelRequest, cancelRequest)
  yield Saga.actionToPromise(WalletsGen.cancelPayment, cancelPayment)

  yield Saga.actionToAction(ConfigGen.setupEngineListeners, setupEngineListeners)

  // Clear some errors on navigateUp, clear new txs on switchTab
  yield Saga.actionToAction(RouteTreeGen.navigateUp, maybeClearErrors)
  yield Saga.safeTakeEveryPure(RouteTreeGen.switchTo, maybeClearNewTxs)

  yield Saga.actionToAction(NotificationsGen.receivedBadgeState, receivedBadgeState)

  yield Saga.actionToPromise(
    [WalletsGen.loadAccounts, ConfigGen.loggedIn, WalletsGen.loadWalletDisclaimer],
    loadWalletDisclaimer
  )
  yield Saga.actionToPromise(WalletsGen.acceptDisclaimer, acceptDisclaimer)
  yield Saga.actionToAction(WalletsGen.acceptDisclaimer, maybeNavToLinkExisting)
  yield Saga.actionToAction(WalletsGen.rejectDisclaimer, rejectDisclaimer)
}

export default walletsSaga
