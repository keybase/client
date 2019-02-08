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
import * as Flow from '../util/flow'
import HiddenString from '../util/hidden-string'
import logger from '../logger'
import {getPath} from '../route-tree'
import * as Tabs from '../constants/tabs'
import * as SettingsConstants from '../constants/settings'
import * as I from 'immutable'
import flags from '../util/feature-flags'
import {getEngine} from '../engine'
import {RPCError} from '../util/errors'
import {isMobile} from '../constants/platform'
import {actionHasError} from '../util/container'

const stateToBuildRequestParams = state => ({
  amount: state.wallets.building.amount,
  currency: state.wallets.building.currency === 'XLM' ? null : state.wallets.building.currency,
  secretNote: state.wallets.building.secretNote.stringValue(),
  to: state.wallets.building.to,
})

const buildErrCatcher = err => {
  if (err instanceof RPCError && err.code === RPCTypes.constantsStatusCode.sccanceled) {
    // ignore cancellation
  } else {
    logger.error(`buildPayment error: ${err.message}`)
    throw err
  }
}

const buildPayment = (state, action) =>
  (state.wallets.building.isRequest
    ? RPCStellarTypes.localBuildRequestLocalRpcPromise(
        stateToBuildRequestParams(state),
        Constants.buildPaymentWaitingKey
      ).then(build =>
        WalletsGen.createBuiltRequestReceived({
          build: Constants.buildRequestResultToBuiltRequest(build),
          forBuildCounter: state.wallets.buildCounter,
        })
      )
    : RPCStellarTypes.localBuildPaymentLocalRpcPromise(
        {
          amount: state.wallets.building.amount,
          bid: state.wallets.building.bid,
          currency: ['XLM', ''].includes(state.wallets.building.currency)
            ? null
            : state.wallets.building.currency,
          from: state.wallets.building.from === Types.noAccountID ? '' : state.wallets.building.from,
          fromPrimaryAccount: state.wallets.building.from === Types.noAccountID,
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
          forBuildCounter: state.wallets.buildCounter,
        })
      )
  ).catch(buildErrCatcher)

const spawnBuildPayment = (state, action) => {
  if (!state.config.loggedIn) {
    logger.error('Tried to spawnBuildPayment while not logged in')
    return
  }
  if (action.type === WalletsGen.displayCurrencyReceived && !action.payload.setBuildingCurrency) {
    // didn't change state.building; no need to call build
    return
  }
  return WalletsGen.createBuildPayment()
}

const openSendRequestForm = (state, action) => {
  if (!state.wallets.acceptedDisclaimer) {
    // redirect to disclaimer
    return RouteTreeGen.createNavigateTo({path: Constants.rootWalletPath})
  }

  // load accounts for default display currency
  const accountsLoaded = Constants.getAccounts(state).size > 0
  return [
    !accountsLoaded && WalletsGen.createLoadAccounts({reason: 'open-send-req-form'}),
    RouteTreeGen.createNavigateAppend({path: [Constants.sendRequestFormRouteKey]}),
  ]
}

const maybePopulateBuildingCurrency = (state, action) =>
  (state.wallets.building.bid || state.wallets.building.isRequest) && !state.wallets.building.currency // building a payment and haven't set currency yet
    ? WalletsGen.createSetBuildingCurrency({currency: Constants.getDefaultDisplayCurrency(state).code})
    : null

const createNewAccount = (state, action) => {
  const {name} = action.payload
  return RPCStellarTypes.localCreateWalletAccountLocalRpcPromise({name}, Constants.createNewAccountWaitingKey)
    .then(accountIDString => Types.stringToAccountID(accountIDString))
    .then(accountID =>
      WalletsGen.createCreatedNewAccount({
        accountID,
        setBuildingTo: action.payload.setBuildingTo,
        showOnCreation: action.payload.showOnCreation,
      })
    )
    .catch(err => {
      logger.warn(`Error creating new account: ${err.desc}`)
      return WalletsGen.createCreatedNewAccountError({error: err.desc, name})
    })
}

const emptyAsset = {code: '', issuer: '', issuerName: '', type: 'native', verifiedDomain: ''}

const sendPayment = state => {
  const notXLM = state.wallets.building.currency !== '' && state.wallets.building.currency !== 'XLM'
  return RPCStellarTypes.localSendPaymentLocalRpcPromise(
    {
      amount: notXLM ? state.wallets.builtPayment.worthAmount : state.wallets.building.amount,
      asset: emptyAsset,
      // FIXME -- support other assets.
      bid: state.wallets.building.bid,
      bypassBid: false,
      bypassReview: false,
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

const setLastSentXLM = (state, action) =>
  WalletsGen.createSetLastSentXLM({
    lastSentXLM: action.payload.lastSentXLM,
    writeFile: true,
  })

function* requestPayment(state) {
  let buildRes
  try {
    buildRes = yield* Saga.callPromise(
      RPCStellarTypes.localBuildRequestLocalRpcPromise,
      stateToBuildRequestParams(state),
      Constants.requestPaymentWaitingKey
    )
  } catch (err) {
    buildErrCatcher(err)
    return
  }
  if (!buildRes.readyToRequest) {
    logger.warn(
      `requestPayment: invalid form submitted. amountErr: ${buildRes.amountErrMsg}; secretNoteErr: ${
        buildRes.secretNoteErrMsg
      }; toErrMsg: ${buildRes.toErrMsg}`
    )
    yield Saga.put(
      WalletsGen.createBuiltRequestReceived({
        build: Constants.buildRequestResultToBuiltRequest(buildRes),
        forBuildCounter: state.wallets.buildCounter,
      })
    )
    return
  }
  const kbRqID = yield* Saga.callPromise(
    RPCStellarTypes.localMakeRequestLocalRpcPromise,
    {
      amount: state.wallets.building.amount,
      // FIXME -- support other assets.
      asset: state.wallets.building.currency === 'XLM' ? emptyAsset : undefined,
      currency:
        state.wallets.building.currency && state.wallets.building.currency !== 'XLM'
          ? state.wallets.building.currency
          : undefined,
      note: state.wallets.building.secretNote.stringValue(),
      recipient: state.wallets.building.to,
    },
    Constants.requestPaymentWaitingKey
  )
  const navAction = maybeNavigateAwayFromSendForm(state)
  yield Saga.sequentially([
    ...(navAction ? [Saga.put(navAction)] : []),
    Saga.put(
      WalletsGen.createRequestedPayment({
        kbRqID: new HiddenString(kbRqID),
        lastSentXLM: state.wallets.building.currency === 'XLM',
        requestee: state.wallets.building.to,
      })
    ),
  ])
}

const startPayment = state =>
  state.wallets.acceptedDisclaimer && !state.wallets.building.isRequest
    ? RPCStellarTypes.localStartBuildPaymentLocalRpcPromise().then(bid =>
        WalletsGen.createBuildingPaymentIDReceived({bid})
      )
    : null

const reviewPayment = state =>
  RPCStellarTypes.localReviewPaymentLocalRpcPromise({
    bid: state.wallets.building.bid,
    reviewID: state.wallets.reviewCounter,
  }).catch(error => {
    if (error instanceof RPCError && error.code === RPCTypes.constantsStatusCode.sccanceled) {
      // ignore cancellation, which is expected in the case where we have a
      // failing review and then we build or stop a payment
    } else {
      return WalletsGen.createSentPaymentError({error: error.desc})
    }
  })

const stopPayment = (state, action) =>
  RPCStellarTypes.localStopBuildPaymentLocalRpcPromise({bid: state.wallets.building.bid})

const clearBuiltPayment = () => WalletsGen.createClearBuiltPayment()
const clearBuiltRequest = () => WalletsGen.createClearBuiltRequest()

const clearBuilding = () => WalletsGen.createClearBuilding()

const clearErrors = () => WalletsGen.createClearErrors()

const loadWalletDisclaimer = () =>
  RPCStellarTypes.localHasAcceptedDisclaimerLocalRpcPromise().then(accepted =>
    WalletsGen.createWalletDisclaimerReceived({accepted})
  )

const loadAccounts = (state, action) => {
  if (!state.config.loggedIn) {
    logger.error('Tried to loadAccounts while not logged in')
    return
  }
  if (actionHasError(action)) {
    return
  }
  return RPCStellarTypes.localGetWalletAccountsLocalRpcPromise(undefined, [
    Constants.checkOnlineWaitingKey,
    Constants.loadAccountsWaitingKey,
  ])
    .then(res => {
      return WalletsGen.createAccountsReceived({
        accounts: (res || []).map(account => {
          if (!account.accountID) {
            logger.error(
              `Found empty accountID in getWalletAccounts, name: ${account.name} isDefault: ${String(
                account.isDefault
              )}`
            )
          }
          return Constants.accountResultToAccount(account)
        }),
      })
    })
    .catch(err => {
      const msg = `Error loading accounts: ${err.desc}`
      if (action.type === WalletsGen.loadAccounts && action.payload.reason === 'initial-load') {
        // No need to throw black bars -- handled by Reloadable.
        logger.warn(msg)
      } else {
        logger.error(msg)
        throw err
      }
    })
}

const handleSelectAccountError = (action, msg, err) => {
  const errMsg = `Error ${msg}: ${err.desc}`
  // Assume that for auto-selected we're on the Wallets tab.
  if (
    (action.type === WalletsGen.selectAccount && action.payload.reason === 'user-selected') ||
    action.payload.reason === 'auto-selected'
  ) {
    // No need to throw black bars -- handled by Reloadable.
    logger.warn(errMsg)
  } else {
    logger.error(errMsg)
    throw err
  }
}

const loadAssets = (state, action) => {
  if (actionHasError(action)) {
    return
  }
  if (!state.config.loggedIn) {
    logger.error('Tried to loadAssets while not logged in')
    return
  }
  let accountID
  switch (action.type) {
    case WalletsGen.loadAssets:
    case WalletsGen.linkedExistingAccount:
    case WalletsGen.selectAccount:
      accountID = action.payload.accountID
      break
    case WalletsGen.accountUpdateReceived:
      accountID = action.payload.account.accountID
      break
    case WalletsGen.accountsReceived:
      // this covers the case when you create a new account
      // a bit overkill since it'll do this for accounts we've already loaded
      // TODO cut loads down to only the ones we need
      accountID = state.wallets.selectedAccount
      break
    default:
      Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(action)
      return
  }
  // check that we've loaded the account, don't load assets if we don't have the account
  accountID = Constants.getAccount(state, accountID).accountID
  if (accountID && accountID !== Types.noAccountID) {
    return RPCStellarTypes.localGetAccountAssetsLocalRpcPromise({accountID}, Constants.checkOnlineWaitingKey)
      .then(res =>
        WalletsGen.createAssetsReceived({
          accountID,
          assets: (res || []).map(assets => Constants.assetsResultToAssets(assets)),
        })
      )
      .catch(err => handleSelectAccountError(action, 'selecting account', err))
  }
}

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

const loadPayments = (state, action) => {
  if (!state.config.loggedIn) {
    logger.error('Tried to loadPayments while not logged in')
    return
  }
  if (!action.payload.accountID) {
    const account = Constants.getAccount(state, action.payload.accountID)
    logger.error(
      `Tried to call load with no account ID, found matching account name: ${
        account.name
      } isDefault: ${String(account.isDefault)}`
    )
  }
  return (
    !actionHasError(action) &&
    (!!(
      action.type === WalletsGen.selectAccount &&
      action.payload.accountID &&
      action.payload.accountID !== Types.noAccountID
    ) ||
      Constants.getAccount(state, action.payload.accountID).accountID !== Types.noAccountID) &&
    Promise.all([
      RPCStellarTypes.localGetPendingPaymentsLocalRpcPromise({accountID: action.payload.accountID}),
      RPCStellarTypes.localGetPaymentsLocalRpcPromise({accountID: action.payload.accountID}),
    ]).then(([pending, payments]) => createPaymentsReceived(action.payload.accountID, payments, pending))
  )
}

const loadMorePayments = (state, action) => {
  if (!state.config.loggedIn) {
    logger.error('Tried to loadMorePayments while not logged in')
    return
  }
  const cursor = state.wallets.paymentCursorMap.get(action.payload.accountID)
  return (
    cursor &&
    RPCStellarTypes.localGetPaymentsLocalRpcPromise({accountID: action.payload.accountID, cursor}).then(
      payments => createPaymentsReceived(action.payload.accountID, payments, [])
    )
  )
}

// We only need to load these once per session
const loadDisplayCurrencies = (state, action) =>
  !Constants.displayCurrenciesLoaded(state) &&
  RPCStellarTypes.localGetDisplayCurrenciesLocalRpcPromise().then(res =>
    WalletsGen.createDisplayCurrenciesReceived({
      currencies: (res || []).map(c => Constants.currencyResultToCurrency(c)),
    })
  )

const loadSendAssetChoices = (state, action) =>
  RPCStellarTypes.localGetSendAssetChoicesLocalRpcPromise({
    from: action.payload.from,
    to: action.payload.to,
  }).then(res => {
    res && WalletsGen.createSendAssetChoicesReceived({sendAssetChoices: res})
  })

const loadDisplayCurrency = (state, action) => {
  let accountID = action.payload.accountID
  if (accountID && !Types.isValidAccountID(accountID)) {
    accountID = null
  }
  return RPCStellarTypes.localGetDisplayCurrencyLocalRpcPromise(
    {accountID: accountID},
    Constants.getDisplayCurrencyWaitingKey(accountID || Types.noAccountID)
  ).then(res =>
    WalletsGen.createDisplayCurrencyReceived({
      accountID: accountID,
      currency: Constants.makeCurrency(res),
      setBuildingCurrency: action.payload.setBuildingCurrency,
    })
  )
}
const setInflationDestination = (_, action) => {
  const accountID = action.payload.accountID
  if (!accountID || !Types.isValidAccountID(accountID)) {
    return
  }
  return RPCStellarTypes.localSetInflationDestinationLocalRpcPromise(
    {
      accountID,
      destination: action.payload.destination,
    },

    Constants.inflationDestinationWaitingKey
  )
    .then(() =>
      WalletsGen.createInflationDestinationReceived({
        accountID,
        selected: Constants.makeAccountInflationDestination({
          accountID: action.payload.destination,
          name: action.payload.name,
        }),
      })
    )
    .catch(error =>
      WalletsGen.createInflationDestinationReceivedError({
        error: error.message,
      })
    )
}
const loadInflationDestination = (_, action) => {
  const accountID = action.payload.accountID
  if (!accountID || !Types.isValidAccountID(accountID)) {
    return
  }
  return Promise.all([
    RPCStellarTypes.localGetInflationDestinationLocalRpcPromise({accountID}),
    RPCStellarTypes.localGetPredefinedInflationDestinationsLocalRpcPromise(),
  ]).then(([dest, predefs]) => {
    const options = (predefs || []).map(p =>
      Constants.makeInflationDestination({
        address: Types.stringToAccountID(p.accountID),
        link: p.url,
        name: p.name,
        recommended: p.recommended,
      })
    )

    return WalletsGen.createInflationDestinationReceived({
      accountID,
      options,
      selected: Constants.inflationDestResultToAccountInflationDest(dest),
    })
  })
}

const refreshAssets = (state, action) =>
  action.payload.accountID ? WalletsGen.createLoadAssets({accountID: action.payload.accountID}) : undefined

const changeDisplayCurrency = (state, action) =>
  RPCStellarTypes.localChangeDisplayCurrencyLocalRpcPromise(
    {
      accountID: action.payload.accountID,
      currency: action.payload.code, // called currency, though it is a code
    },
    Constants.changeDisplayCurrencyWaitingKey
  )

const changeAccountName = (state, action) =>
  RPCStellarTypes.localChangeWalletAccountNameLocalRpcPromise(
    {
      accountID: action.payload.accountID,
      newName: action.payload.name,
    },
    Constants.changeAccountNameWaitingKey
  ).then(res => WalletsGen.createChangedAccountName({accountID: action.payload.accountID}))

const deleteAccount = (state, action) =>
  RPCStellarTypes.localDeleteWalletAccountLocalRpcPromise(
    {
      accountID: action.payload.accountID,
      userAcknowledged: 'yes',
    },
    Constants.deleteAccountWaitingKey
  ).then(res => WalletsGen.createDeletedAccount())

const setAccountAsDefault = (state, action) =>
  RPCStellarTypes.localSetWalletAccountAsDefaultLocalRpcPromise(
    {accountID: action.payload.accountID},
    Constants.setAccountAsDefaultWaitingKey
  ).then(res => WalletsGen.createDidSetAccountAsDefault({accountID: action.payload.accountID}))

const loadPaymentDetail = (state, action) =>
  RPCStellarTypes.localGetPaymentDetailsLocalRpcPromise(
    {
      accountID: action.payload.accountID,
      id: Types.paymentIDToRPCPaymentID(action.payload.paymentID),
    },
    [Constants.checkOnlineWaitingKey, Constants.getRequestDetailsWaitingKey(action.payload.paymentID)]
  )
    .then(res =>
      WalletsGen.createPaymentDetailReceived({
        accountID: action.payload.accountID,
        payment: Constants.rpcPaymentDetailToPaymentDetail(res),
      })
    )
    .catch(err => {
      // No need to throw black bars -- handled by Reloadable.
      logger.warn(`Error marking as read: ${err.desc}`)
    })

const markAsRead = (state, action) =>
  RPCStellarTypes.localMarkAsReadLocalRpcPromise({
    accountID: action.payload.accountID,
    mostRecentID: Types.paymentIDToRPCPaymentID(action.payload.mostRecentID),
  }).catch(err => {
    // No need to throw black bars.
    logger.warn(`Error marking as read: ${err.desc}`)
  })

const linkExistingAccount = (state, action) => {
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
        setBuildingTo: action.payload.setBuildingTo,
        showOnCreation: action.payload.showOnCreation,
      })
    )
    .catch(err => {
      logger.warn(`Error linking existing account: ${err.desc}`)
      return WalletsGen.createLinkedExistingAccountError({error: err.desc, name, secretKey})
    })
}

const validateAccountName = (state, action) => {
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

const validateSecretKey = (state, action) => {
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

const deletedAccount = state =>
  WalletsGen.createSelectAccount({
    accountID: state.wallets.accountMap.find(account => account.isDefault).accountID,
    reason: 'auto-selected',
    show: true,
  })

const createdOrLinkedAccount = (state, action) => {
  if (actionHasError(action)) {
    // Create new account failed, don't nav
    return
  }
  if (action.payload.showOnCreation) {
    return WalletsGen.createSelectAccount({
      accountID: action.payload.accountID,
      reason: 'auto-selected',
      show: true,
    })
  }
  if (action.payload.setBuildingTo) {
    return WalletsGen.createSetBuildingTo({to: action.payload.accountID})
  }
  return RouteTreeGen.createNavigateUp()
}

const navigateUp = (state, action) => {
  if (actionHasError(action)) {
    // we don't want to nav on error
    return
  }
  return RouteTreeGen.createNavigateUp()
}

const navigateToAccount = (state, action) => {
  if (action.type === WalletsGen.selectAccount && !action.payload.show) {
    // we don't want to show, don't nav
    return
  }
  const wallet = isMobile
    ? [Tabs.settingsTab, SettingsConstants.walletsTab]
    : [{props: {}, selected: Tabs.walletsTab}, {props: {}, selected: null}]

  return RouteTreeGen.createNavigateTo({path: wallet})
}

const exportSecretKey = (state, action) =>
  RPCStellarTypes.localGetWalletAccountSecretKeyLocalRpcPromise({accountID: action.payload.accountID}).then(
    res =>
      WalletsGen.createSecretKeyReceived({
        accountID: action.payload.accountID,
        secretKey: new HiddenString(res),
      })
  )

const maybeSelectDefaultAccount = (state, action) => {
  if (!state.config.loggedIn) {
    logger.error('Tried to maybeSelectDefaultAccount while not logged in')
    return
  }
  if (state.wallets.selectedAccount === Types.noAccountID) {
    const maybeDefaultAccount = state.wallets.accountMap.find(account => account.isDefault)
    if (maybeDefaultAccount) {
      return WalletsGen.createSelectAccount({
        accountID: maybeDefaultAccount.accountID,
        reason: 'auto-selected',
      })
    }
  }
}

const cancelPayment = (state, action) => {
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
        return WalletsGen.createSelectAccount({
          accountID: Constants.getSelectedAccount(state),
          reason: 'auto-selected',
          show: true,
        })
      }
    })
    .catch(err => {
      logger.error(`cancelPayment: failed to cancel payment with ID ${pid}. Error: ${err.message}`)
      throw err
    })
}

const cancelRequest = (state, action) =>
  RPCStellarTypes.localCancelRequestLocalRpcPromise({reqID: action.payload.requestID}).catch(err =>
    logger.error(`Error cancelling request: ${err.message}`)
  )

const maybeNavigateAwayFromSendForm = state => {
  const routeState = state.routeTree.routeState
  const path = getPath(routeState)
  const lastNode = path.last()
  if (Constants.sendRequestFormRoutes.includes(lastNode)) {
    if (path.first() === Tabs.walletsTab) {
      // User is on send form in wallets tab, navigate back to root of tab
      return RouteTreeGen.createNavigateTo({
        path: [{props: {}, selected: Tabs.walletsTab}, {props: {}, selected: null}],
      })
    }
    // User is somewhere else, send them to most recent parent that isn't a form route
    const firstFormIndex = path.findIndex(node => Constants.sendRequestFormRoutes.includes(node))
    const pathAboveForm = path.slice(0, firstFormIndex)
    return RouteTreeGen.createNavigateTo({path: pathAboveForm})
  }
}

const maybeNavigateToConversation = (state, action) => {
  // nav to previewed conversation if we aren't already on the chat tab
  const routeState = state.routeTree.routeState
  const path = getPath(routeState)
  if (path.first() === Tabs.chatTab) {
    return maybeNavigateAwayFromSendForm(state)
  }
  // not on chat tab; preview
  logger.info('Navigating to conversation because we requested a payment')
  return Chat2Gen.createPreviewConversation({
    participants: [action.payload.requestee],
    reason: 'requestedPayment',
  })
}

const setupEngineListeners = () => {
  getEngine().setIncomingCallMap({
    'stellar.1.notify.accountDetailsUpdate': ({accountID, account}) =>
      Saga.put(
        WalletsGen.createAccountUpdateReceived({
          account: Constants.accountResultToAccount(account),
        })
      ),
    'stellar.1.notify.accountsUpdate': ({accounts}) =>
      Saga.put(
        WalletsGen.createAccountsReceived({
          accounts: (accounts || []).map(account => {
            if (!account.accountID) {
              logger.error(
                `Found empty accountID in accountsUpdate, name: ${account.name} isDefault: ${String(
                  account.isDefault
                )}`
              )
            }
            return Constants.accountResultToAccount(account)
          }),
        })
      ),
    'stellar.1.notify.pendingPaymentsUpdate': ({accountID: _accountID, pending: _pending}) => {
      if (!_pending) {
        logger.warn(`pendingPaymentsUpdate: no pending payments in payload`)
        return
      }
      const accountID = Types.stringToAccountID(_accountID)
      const pending = _pending.map(p => Constants.rpcPaymentResultToPaymentResult(p, 'pending'))
      return Saga.put(WalletsGen.createPendingPaymentsReceived({accountID, pending}))
    },
    'stellar.1.notify.recentPaymentsUpdate': ({accountID, firstPage: {payments, cursor, oldestUnread}}) =>
      Saga.put(
        WalletsGen.createRecentPaymentsReceived({
          accountID: Types.stringToAccountID(accountID),
          oldestUnread: oldestUnread ? Types.rpcPaymentIDToPaymentID(oldestUnread) : Types.noPaymentID,
          paymentCursor: cursor,
          payments: (payments || [])
            .map(elem => Constants.rpcPaymentResultToPaymentResult(elem, 'history'))
            .filter(Boolean),
        })
      ),
    'stellar.1.ui.paymentReviewed': ({msg: {bid, reviewID, seqno, banners, nextButton}}) =>
      Saga.put(WalletsGen.createReviewedPaymentReceived({banners, bid, nextButton, reviewID, seqno})),
  })
}

const maybeClearErrors = state => {
  const routePath = getPath(state.routeTree.routeState)
  const selectedTab = routePath.first()
  if (selectedTab === Tabs.walletsTab) {
    return WalletsGen.createClearErrors()
  }
}

const maybeClearNewTxs = (state, action) => {
  const rootTab = I.List(action.payload.path).first()
  // If we're leaving from the Wallets tab, and the Wallets tab route
  // was the main transaction list for an account, clear new txs.
  if (
    state.routeTree.previousTab === Constants.rootWalletTab &&
    rootTab !== Constants.rootWalletTab &&
    Constants.isLookingAtWallet(state.routeTree.routeState)
  ) {
    const accountID = state.wallets.selectedAccount
    if (accountID !== Types.noAccountID) {
      return WalletsGen.createClearNewPayments({accountID})
    }
  }
}

const receivedBadgeState = (state, action) =>
  WalletsGen.createBadgesUpdated({accounts: action.payload.badgeState.unreadWalletAccounts || []})

const acceptDisclaimer = (state, action) =>
  RPCStellarTypes.localAcceptDisclaimerLocalRpcPromise(undefined, Constants.acceptDisclaimerWaitingKey).catch(
    e => {
      // disclaimer screen handles showing error
      // reset delay state
      return WalletsGen.createResetAcceptingDisclaimer()
    }
  )

const checkDisclaimer = state =>
  RPCStellarTypes.localHasAcceptedDisclaimerLocalRpcPromise().then(accepted =>
    WalletsGen.createWalletDisclaimerReceived({accepted})
  )

const maybeNavToLinkExisting = (state, action) =>
  action.payload.nextScreen === 'linkExisting' &&
  RouteTreeGen.createNavigateTo({
    path: [...Constants.rootWalletPath, ...(isMobile ? ['linkExisting'] : ['wallet', 'linkExisting'])],
  })

const rejectDisclaimer = (state, action) =>
  isMobile
    ? RouteTreeGen.createNavigateTo({
        path: [{props: {}, selected: Tabs.settingsTab}, {props: {}, selected: null}],
      })
    : RouteTreeGen.createSwitchTo({path: [state.routeTree.get('previousTab') || Tabs.peopleTab]})

const loadMobileOnlyMode = (state, action) => {
  let accountID = action.payload.accountID
  if (!accountID || accountID === Types.noAccountID) {
    logger.warn('loadMobileOnlyMode invalid account ID, bailing')
    return
  }
  return RPCStellarTypes.localIsAccountMobileOnlyLocalRpcPromise({
    accountID,
  })
    .then(res =>
      WalletsGen.createLoadedMobileOnlyMode({
        accountID,
        enabled: res,
      })
    )
    .catch(err => handleSelectAccountError(action, 'loading mobile only mode', err))
}

const changeMobileOnlyMode = (state, action) => {
  let accountID = action.payload.accountID
  let f = action.payload.enabled
    ? RPCStellarTypes.localSetAccountMobileOnlyLocalRpcPromise
    : RPCStellarTypes.localSetAccountAllDevicesLocalRpcPromise
  return f({accountID}, Constants.setAccountMobileOnlyWaitingKey(accountID)).then(res => [
    WalletsGen.createLoadedMobileOnlyMode({accountID, enabled: action.payload.enabled}),
    WalletsGen.createLoadMobileOnlyMode({accountID}),
  ])
}

const writeLastSentXLM = (state, action) => {
  if (action.payload.writeFile) {
    logger.info(`Writing config stellar.lastSentXLM: ${String(state.wallets.lastSentXLM)}`)
    return RPCTypes.configSetValueRpcPromise({
      path: 'stellar.lastSentXLM',
      value: {b: state.wallets.lastSentXLM, isNull: false},
    }).catch(err => logger.error(`Error writing config stellar.lastSentXLM: ${err.message}`))
  }
}

const readLastSentXLM = () => {
  logger.info(`Reading config stellar.lastSentXLM`)
  return RPCTypes.configGetValueRpcPromise({path: 'stellar.lastSentXLM'})
    .then(result => {
      const value = !result.isNull && !!result.b
      logger.info(`Successfully read config stellar.lastSentXLM: ${String(value)}`)
      return WalletsGen.createSetLastSentXLM({lastSentXLM: value, writeFile: false})
    })
    .catch(err => {
      err.message.includes('no such key')
        ? null
        : logger.error(`Error reading config stellar.lastSentXLM: ${err.message}`)
    })
}

const exitFailedPayment = (state, action) => {
  const accountID = state.wallets.builtPayment.from
  return [
    WalletsGen.createAbandonPayment(),
    WalletsGen.createSelectAccount({accountID, reason: 'auto-selected', show: true}),
    WalletsGen.createLoadPayments({accountID}),
  ]
}

function* walletsSaga(): Saga.SagaGenerator<any, any> {
  if (!flags.walletsEnabled) {
    console.log('Wallets saga disabled')
    return
  }

  yield* Saga.chainAction<WalletsGen.CreateNewAccountPayload>(WalletsGen.createNewAccount, createNewAccount)
  yield* Saga.chainAction<
    | WalletsGen.LoadAccountsPayload
    | WalletsGen.CreatedNewAccountPayload
    | WalletsGen.LinkedExistingAccountPayload
    | WalletsGen.ChangedAccountNamePayload
    | WalletsGen.DeletedAccountPayload
  >(
    [
      WalletsGen.loadAccounts,
      WalletsGen.createdNewAccount,
      WalletsGen.linkedExistingAccount,
      WalletsGen.changedAccountName,
      WalletsGen.deletedAccount,
    ],
    loadAccounts
  )
  yield* Saga.chainAction<
    | WalletsGen.LoadAssetsPayload
    | WalletsGen.SelectAccountPayload
    | WalletsGen.LinkedExistingAccountPayload
    | WalletsGen.AccountUpdateReceivedPayload
    | WalletsGen.AccountsReceivedPayload
  >(
    [
      WalletsGen.loadAssets,
      WalletsGen.selectAccount,
      WalletsGen.linkedExistingAccount,
      WalletsGen.accountUpdateReceived,
      WalletsGen.accountsReceived,
    ],
    loadAssets
  )
  yield* Saga.chainAction<
    WalletsGen.LoadPaymentsPayload | WalletsGen.SelectAccountPayload | WalletsGen.LinkedExistingAccountPayload
  >([WalletsGen.loadPayments, WalletsGen.selectAccount, WalletsGen.linkedExistingAccount], loadPayments)
  yield* Saga.chainAction<WalletsGen.LoadMorePaymentsPayload>(WalletsGen.loadMorePayments, loadMorePayments)
  yield* Saga.chainAction<WalletsGen.DeleteAccountPayload>(WalletsGen.deleteAccount, deleteAccount)
  yield* Saga.chainAction<WalletsGen.LoadPaymentDetailPayload>(
    WalletsGen.loadPaymentDetail,
    loadPaymentDetail
  )
  yield* Saga.chainAction<WalletsGen.MarkAsReadPayload>(WalletsGen.markAsRead, markAsRead)
  yield* Saga.chainAction<WalletsGen.LinkExistingAccountPayload>(
    WalletsGen.linkExistingAccount,
    linkExistingAccount
  )
  yield* Saga.chainAction<WalletsGen.ValidateAccountNamePayload>(
    WalletsGen.validateAccountName,
    validateAccountName
  )
  yield* Saga.chainAction<WalletsGen.ValidateSecretKeyPayload>(
    WalletsGen.validateSecretKey,
    validateSecretKey
  )
  yield* Saga.chainAction<WalletsGen.ExportSecretKeyPayload>(WalletsGen.exportSecretKey, exportSecretKey)
  yield* Saga.chainAction<WalletsGen.LoadDisplayCurrenciesPayload, WalletsGen.OpenSendRequestFormPayload>(
    [WalletsGen.loadDisplayCurrencies, WalletsGen.openSendRequestForm],
    loadDisplayCurrencies
  )
  yield* Saga.chainAction<WalletsGen.LoadSendAssetChoicesPayload>(
    WalletsGen.loadSendAssetChoices,
    loadSendAssetChoices
  )
  yield* Saga.chainAction<WalletsGen.LoadDisplayCurrencyPayload>(
    WalletsGen.loadDisplayCurrency,
    loadDisplayCurrency
  )
  yield* Saga.chainAction<WalletsGen.LoadInflationDestinationPayload>(
    WalletsGen.loadInflationDestination,
    loadInflationDestination
  )
  yield* Saga.chainAction<WalletsGen.SetInflationDestinationPayload>(
    WalletsGen.setInflationDestination,
    setInflationDestination
  )
  yield* Saga.chainAction<WalletsGen.DisplayCurrencyReceivedPayload>(
    WalletsGen.displayCurrencyReceived,
    refreshAssets
  )
  yield* Saga.chainAction<WalletsGen.ChangeDisplayCurrencyPayload>(
    WalletsGen.changeDisplayCurrency,
    changeDisplayCurrency
  )
  yield* Saga.chainAction<WalletsGen.SetAccountAsDefaultPayload>(
    WalletsGen.setAccountAsDefault,
    setAccountAsDefault
  )
  yield* Saga.chainAction<WalletsGen.ChangeAccountNamePayload>(
    WalletsGen.changeAccountName,
    changeAccountName
  )
  yield* Saga.chainAction<WalletsGen.SelectAccountPayload>(WalletsGen.selectAccount, navigateToAccount)
  yield* Saga.chainAction<WalletsGen.DidSetAccountAsDefaultPayload, WalletsGen.ChangedAccountNamePayload>(
    [WalletsGen.didSetAccountAsDefault, WalletsGen.changedAccountName],
    navigateUp
  )
  yield* Saga.chainAction<WalletsGen.CreatedNewAccountPayload | WalletsGen.LinkedExistingAccountPayload>(
    [WalletsGen.createdNewAccount, WalletsGen.linkedExistingAccount],
    createdOrLinkedAccount
  )
  yield* Saga.chainAction<WalletsGen.AccountsReceivedPayload>(
    WalletsGen.accountsReceived,
    maybeSelectDefaultAccount
  )

  // We don't call this for publicMemo/secretNote so the button doesn't
  // spinner as you type
  yield* Saga.chainAction<WalletsGen.BuildPaymentPayload>(WalletsGen.buildPayment, buildPayment)
  yield* Saga.chainAction<
    | WalletsGen.SetBuildingAmountPayload
    | WalletsGen.SetBuildingCurrencyPayload
    | WalletsGen.SetBuildingFromPayload
    | WalletsGen.SetBuildingIsRequestPayload
    | WalletsGen.SetBuildingToPayload
    | WalletsGen.DisplayCurrencyReceivedPayload
    | WalletsGen.BuildingPaymentIDReceivedPayload
  >(
    [
      WalletsGen.setBuildingAmount,
      WalletsGen.setBuildingCurrency,
      WalletsGen.setBuildingFrom,
      WalletsGen.setBuildingIsRequest,
      WalletsGen.setBuildingTo,
      WalletsGen.displayCurrencyReceived,
      WalletsGen.buildingPaymentIDReceived,
    ],
    spawnBuildPayment
  )
  yield* Saga.chainAction<WalletsGen.OpenSendRequestFormPayload>(
    WalletsGen.openSendRequestForm,
    openSendRequestForm
  )
  yield* Saga.chainAction<WalletsGen.ReviewPaymentPayload>(WalletsGen.reviewPayment, reviewPayment)
  yield* Saga.chainAction<WalletsGen.OpenSendRequestFormPayload>(WalletsGen.openSendRequestForm, startPayment)
  yield* Saga.chainAction<WalletsGen.AccountsReceivedPayload>(
    WalletsGen.accountsReceived,
    maybePopulateBuildingCurrency
  )

  yield* Saga.chainAction<WalletsGen.DeletedAccountPayload>(WalletsGen.deletedAccount, deletedAccount)

  yield* Saga.chainAction<WalletsGen.SendPaymentPayload>(WalletsGen.sendPayment, sendPayment)
  yield* Saga.chainAction<WalletsGen.SentPaymentPayload, WalletsGen.RequestedPaymentPayload>(
    [WalletsGen.sentPayment, WalletsGen.requestedPayment],
    setLastSentXLM
  )
  yield* Saga.chainAction<WalletsGen.SentPaymentPayload | WalletsGen.RequestedPaymentPayload>(
    [WalletsGen.sentPayment, WalletsGen.requestedPayment],
    clearBuilding
  )
  yield* Saga.chainAction<WalletsGen.SentPaymentPayload>(WalletsGen.sentPayment, clearBuiltPayment)
  yield* Saga.chainAction<WalletsGen.SentPaymentPayload | WalletsGen.AbandonPaymentPayload>(
    [WalletsGen.sentPayment, WalletsGen.abandonPayment],
    clearErrors
  )

  yield* Saga.chainAction<WalletsGen.SentPaymentPayload | WalletsGen.AbandonPaymentPayload>(
    [WalletsGen.abandonPayment, WalletsGen.sentPayment],
    maybeNavigateAwayFromSendForm
  )

  yield* Saga.chainGenerator<WalletsGen.RequestPaymentPayload>(WalletsGen.requestPayment, requestPayment)
  yield* Saga.chainAction<WalletsGen.RequestedPaymentPayload | WalletsGen.AbandonPaymentPayload>(
    [WalletsGen.requestedPayment, WalletsGen.abandonPayment],
    clearBuiltRequest
  )
  yield* Saga.chainAction<WalletsGen.RequestedPaymentPayload>(
    WalletsGen.requestedPayment,
    maybeNavigateToConversation
  )

  // Effects of abandoning payments
  yield* Saga.chainAction<WalletsGen.AbandonPaymentPayload>(WalletsGen.abandonPayment, stopPayment)

  yield* Saga.chainAction<WalletsGen.ExitFailedPaymentPayload>(
    WalletsGen.exitFailedPayment,
    exitFailedPayment
  )
  yield* Saga.chainAction<WalletsGen.CancelRequestPayload>(WalletsGen.cancelRequest, cancelRequest)
  yield* Saga.chainAction<WalletsGen.CancelPaymentPayload>(WalletsGen.cancelPayment, cancelPayment)

  yield* Saga.chainAction<ConfigGen.SetupEngineListenersPayload>(
    ConfigGen.setupEngineListeners,
    setupEngineListeners
  )

  // Clear some errors on navigateUp, clear new txs on switchTab
  yield* Saga.chainAction<RouteTreeGen.NavigateUpPayload>(RouteTreeGen.navigateUp, maybeClearErrors)
  yield* Saga.chainAction<RouteTreeGen.SwitchToPayload>(RouteTreeGen.switchTo, maybeClearNewTxs)

  yield* Saga.chainAction<NotificationsGen.ReceivedBadgeStatePayload>(
    NotificationsGen.receivedBadgeState,
    receivedBadgeState
  )

  yield* Saga.chainAction<
    WalletsGen.LoadAccountsPayload | ConfigGen.LoggedInPayload | WalletsGen.LoadWalletDisclaimerPayload
  >([WalletsGen.loadAccounts, ConfigGen.loggedIn, WalletsGen.loadWalletDisclaimer], loadWalletDisclaimer)
  yield* Saga.chainAction<WalletsGen.AcceptDisclaimerPayload>(WalletsGen.acceptDisclaimer, acceptDisclaimer)
  yield* Saga.chainAction<WalletsGen.CheckDisclaimerPayload>(WalletsGen.checkDisclaimer, checkDisclaimer)
  yield* Saga.chainAction<WalletsGen.CheckDisclaimerPayload>(
    WalletsGen.checkDisclaimer,
    maybeNavToLinkExisting
  )
  yield* Saga.chainAction<WalletsGen.RejectDisclaimerPayload>(WalletsGen.rejectDisclaimer, rejectDisclaimer)

  yield* Saga.chainAction<WalletsGen.LoadMobileOnlyModePayload, WalletsGen.SelectAccountPayload>(
    [WalletsGen.loadMobileOnlyMode, WalletsGen.selectAccount],
    loadMobileOnlyMode
  )
  yield* Saga.chainAction<WalletsGen.ChangeMobileOnlyModePayload>(
    WalletsGen.changeMobileOnlyMode,
    changeMobileOnlyMode
  )
  yield* Saga.chainAction<WalletsGen.SetLastSentXLMPayload>(WalletsGen.setLastSentXLM, writeLastSentXLM)
  yield* Saga.chainAction<ConfigGen.DaemonHandshakeDonePayload>(
    ConfigGen.daemonHandshakeDone,
    readLastSentXLM
  )
}

export default walletsSaga
