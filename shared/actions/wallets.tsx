import * as Constants from '../constants/wallets'
import * as Types from '../constants/types/wallets'
import * as RPCStellarTypes from '../constants/types/rpc-stellar-gen'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Saga from '../util/saga'
import * as WalletsGen from './wallets-gen'
import * as EngineGen from './engine-gen-gen'
import * as GregorGen from './gregor-gen'
import * as Chat2Gen from './chat2-gen'
import * as ConfigGen from './config-gen'
import * as NotificationsGen from './notifications-gen'
import * as RouteTreeGen from './route-tree-gen'
import * as Flow from '../util/flow'
import * as Router2Constants from '../constants/router2'
import HiddenString from '../util/hidden-string'
import logger from '../logger'
import * as Tabs from '../constants/tabs'
import * as SettingsConstants from '../constants/settings'
import * as I from 'immutable'
import flags from '../util/feature-flags'
import {RPCError} from '../util/errors'
import {isMobile} from '../constants/platform'
import {actionHasError, TypedActions} from '../util/container'
import {Action} from 'redux'

const stateToBuildRequestParams = state => ({
  amount: state.wallets.building.amount,
  currency: state.wallets.building.currency === 'XLM' ? null : state.wallets.building.currency,
  secretNote: state.wallets.building.secretNote.stringValue(),
  to: state.wallets.building.to,
})

const buildErrCatcher = err => {
  if (err instanceof RPCError && err.code === RPCTypes.StatusCode.sccanceled) {
    // ignore cancellation
  } else {
    logger.error(`buildPayment error: ${err.message}`)
    throw err
  }
}

const buildPayment = (state, action: WalletsGen.BuildPaymentPayload) =>
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

const spawnBuildPayment = (
  state,
  action:
    | WalletsGen.SetBuildingAmountPayload
    | WalletsGen.SetBuildingCurrencyPayload
    | WalletsGen.SetBuildingFromPayload
    | WalletsGen.SetBuildingIsRequestPayload
    | WalletsGen.SetBuildingToPayload
    | WalletsGen.DisplayCurrencyReceivedPayload
    | WalletsGen.BuildingPaymentIDReceivedPayload,
  logger
) => {
  if (!state.config.loggedIn) {
    logger.error('not logged in')
    return
  }
  if (action.type === WalletsGen.displayCurrencyReceived && !action.payload.setBuildingCurrency) {
    // didn't change state.building; no need to call build
    return
  }
  return WalletsGen.createBuildPayment()
}

const openSendRequestForm = (state, action: WalletsGen.OpenSendRequestFormPayload) => {
  if (!state.wallets.acceptedDisclaimer) {
    // redirect to disclaimer
    return RouteTreeGen.createNavigateAppend({path: ['walletOnboarding']})
  }

  // load accounts for default display currency
  const accountsLoaded = Constants.getAccounts(state).size > 0
  return [
    !accountsLoaded && WalletsGen.createLoadAccounts({reason: 'open-send-req-form'}),
    RouteTreeGen.createNavigateAppend({path: [Constants.sendRequestFormRouteKey]}),
  ]
}

const maybePopulateBuildingCurrency = (state, action: WalletsGen.AccountsReceivedPayload) =>
  (state.wallets.building.bid || state.wallets.building.isRequest) && !state.wallets.building.currency // building a payment and haven't set currency yet
    ? WalletsGen.createSetBuildingCurrency({currency: Constants.getDefaultDisplayCurrency(state).code})
    : null

const createNewAccount = (state, action: WalletsGen.CreateNewAccountPayload, logger) => {
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
      logger.warn(`Error: ${err.desc}`)
      return WalletsGen.createCreatedNewAccountError({error: err.desc, name})
    })
}

const emptyAsset = {
  code: '',
  desc: '',
  infoUrl: '',
  infoUrlText: '',
  issuer: '',
  issuerName: '',
  type: 'native',
  verifiedDomain: '',
}

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

const setLastSentXLM = (state, action: WalletsGen.SentPaymentPayload | WalletsGen.RequestedPaymentPayload) =>
  WalletsGen.createSetLastSentXLM({
    lastSentXLM: action.payload.lastSentXLM,
    writeFile: true,
  })

function* requestPayment(state, _: WalletsGen.RequestPaymentPayload, logger) {
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
      `invalid form submitted. amountErr: ${buildRes.amountErrMsg}; secretNoteErr: ${
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
    ...(navAction ? navAction.map(n => Saga.put(n)) : []),
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
    if (error instanceof RPCError && error.code === RPCTypes.StatusCode.sccanceled) {
      // ignore cancellation, which is expected in the case where we have a
      // failing review and then we build or stop a payment
    } else {
      return WalletsGen.createSentPaymentError({error: error.desc})
    }
  })

const stopPayment = (state, action: WalletsGen.AbandonPaymentPayload) =>
  RPCStellarTypes.localStopBuildPaymentLocalRpcPromise({bid: state.wallets.building.bid})

const clearBuiltPayment = () => WalletsGen.createClearBuiltPayment()
const clearBuiltRequest = () => WalletsGen.createClearBuiltRequest()

const clearBuilding = () => WalletsGen.createClearBuilding()

const clearErrors = () => WalletsGen.createClearErrors()

const loadWalletDisclaimer = state =>
  !!state.config.username &&
  RPCStellarTypes.localHasAcceptedDisclaimerLocalRpcPromise(undefined, Constants.checkOnlineWaitingKey)
    .then(accepted => WalletsGen.createWalletDisclaimerReceived({accepted}))
    .catch(() => {}) // handled by reloadable

const loadAccounts = (
  state,
  action:
    | WalletsGen.LoadAccountsPayload
    | WalletsGen.CreatedNewAccountPayload
    | WalletsGen.LinkedExistingAccountPayload
    | WalletsGen.ChangedAccountNamePayload
    | WalletsGen.DeletedAccountPayload,
  logger
) => {
  if (!state.config.loggedIn) {
    logger.error('not logged in')
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
              `Found empty accountID, name: ${account.name} isDefault: ${String(account.isDefault)}`
            )
          }
          return Constants.accountResultToAccount(account)
        }),
      })
    })
    .catch(err => {
      const msg = `Error: ${err.desc}`
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

type LoadAssetsActions =
  | WalletsGen.LoadAssetsPayload
  | WalletsGen.SelectAccountPayload
  | WalletsGen.LinkedExistingAccountPayload
  | WalletsGen.AccountUpdateReceivedPayload
  | WalletsGen.AccountsReceivedPayload
const loadAssets = (
  state,
  action:
    | WalletsGen.LoadAssetsPayload
    | WalletsGen.SelectAccountPayload
    | WalletsGen.LinkedExistingAccountPayload
    | WalletsGen.AccountUpdateReceivedPayload
    | WalletsGen.AccountsReceivedPayload,
  logger
) => {
  if (actionHasError(action)) {
    return
  }

  if (!state.config.loggedIn) {
    logger.error('not logged in')
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
      return Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(action)
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

type LoadPaymentsActions =
  | WalletsGen.LoadPaymentsPayload
  | WalletsGen.SelectAccountPayload
  | WalletsGen.LinkedExistingAccountPayload
const loadPayments = (state, action: LoadPaymentsActions, logger) => {
  if (!state.config.loggedIn) {
    logger.error('not logged in')
    return
  }
  if (actionHasError(action)) {
    return
  }
  return (
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

const loadMorePayments = (state, action: WalletsGen.LoadMorePaymentsPayload, logger) => {
  if (!state.config.loggedIn) {
    logger.error('not logged in')
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
const loadDisplayCurrencies = (
  state,
  action: WalletsGen.LoadDisplayCurrenciesPayload | WalletsGen.OpenSendRequestFormPayload
) =>
  !Constants.displayCurrenciesLoaded(state) &&
  RPCStellarTypes.localGetDisplayCurrenciesLocalRpcPromise().then(res =>
    WalletsGen.createDisplayCurrenciesReceived({
      currencies: (res || []).map(c => Constants.currencyResultToCurrency(c)),
    })
  )

const loadSendAssetChoices = (state, action: WalletsGen.LoadSendAssetChoicesPayload) =>
  RPCStellarTypes.localGetSendAssetChoicesLocalRpcPromise({
    from: action.payload.from,
    to: action.payload.to,
  })
    .then(res => {
      // The result is dropped here. See PICNIC-84 for fixing it.
      res && WalletsGen.createSendAssetChoicesReceived({sendAssetChoices: res})
    })
    .catch(err => {
      logger.warn(`Error: ${err.desc}`)
    })

const loadDisplayCurrency = (state, action: WalletsGen.LoadDisplayCurrencyPayload) => {
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

const setInflationDestination = (_, action: WalletsGen.SetInflationDestinationPayload) => {
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

const loadInflationDestination = (_, action: WalletsGen.LoadInflationDestinationPayload) => {
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

const loadExternalPartners = () =>
  RPCStellarTypes.localGetPartnerUrlsLocalRpcPromise().then(partners =>
    WalletsGen.createExternalPartnersReceived({externalPartners: I.List(partners)})
  )

const refreshAssets = (state, action: WalletsGen.DisplayCurrencyReceivedPayload) =>
  action.payload.accountID ? WalletsGen.createLoadAssets({accountID: action.payload.accountID}) : undefined

const changeDisplayCurrency = (state, action: WalletsGen.ChangeDisplayCurrencyPayload) =>
  RPCStellarTypes.localChangeDisplayCurrencyLocalRpcPromise(
    {
      accountID: action.payload.accountID,
      currency: action.payload.code, // called currency, though it is a code
    },
    Constants.changeDisplayCurrencyWaitingKey
  ).then(_ => WalletsGen.createLoadDisplayCurrency({accountID: action.payload.accountID}))

const changeAccountName = (state, action: WalletsGen.ChangeAccountNamePayload) =>
  RPCStellarTypes.localChangeWalletAccountNameLocalRpcPromise(
    {
      accountID: action.payload.accountID,
      newName: action.payload.name,
    },
    Constants.changeAccountNameWaitingKey
  ).then(res => WalletsGen.createChangedAccountName({accountID: action.payload.accountID}))

const deleteAccount = (state, action: WalletsGen.DeleteAccountPayload) =>
  RPCStellarTypes.localDeleteWalletAccountLocalRpcPromise(
    {
      accountID: action.payload.accountID,
      userAcknowledged: 'yes',
    },
    Constants.deleteAccountWaitingKey
  ).then(res => WalletsGen.createDeletedAccount())

const setAccountAsDefault = (state, action: WalletsGen.SetAccountAsDefaultPayload) =>
  RPCStellarTypes.localSetWalletAccountAsDefaultLocalRpcPromise(
    {accountID: action.payload.accountID},
    Constants.setAccountAsDefaultWaitingKey
  ).then(res => WalletsGen.createDidSetAccountAsDefault({accountID: action.payload.accountID}))

const loadPaymentDetail = (state, action: WalletsGen.LoadPaymentDetailPayload, logger) =>
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
      logger.warn(err.desc)
    })

const markAsRead = (state, action: WalletsGen.MarkAsReadPayload, logger) =>
  RPCStellarTypes.localMarkAsReadLocalRpcPromise({
    accountID: action.payload.accountID,
    mostRecentID: Types.paymentIDToRPCPaymentID(action.payload.mostRecentID),
  }).catch(err => {
    // No need to throw black bars.
    logger.warn(err.desc)
  })

const linkExistingAccount = (state, action: WalletsGen.LinkExistingAccountPayload, logger) => {
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
      logger.warn(`Error: ${err.desc}`)
      return WalletsGen.createLinkedExistingAccountError({error: err.desc, name, secretKey})
    })
}

const validateAccountName = (state, action: WalletsGen.ValidateAccountNamePayload, logger) => {
  const {name} = action.payload
  return RPCStellarTypes.localValidateAccountNameLocalRpcPromise(
    {name},
    Constants.validateAccountNameWaitingKey
  )
    .then(() => WalletsGen.createValidatedAccountName({name}))
    .catch(err => {
      logger.warn(`Error: ${err.desc}`)
      return WalletsGen.createValidatedAccountNameError({error: err.desc, name})
    })
}

const validateSecretKey = (state, action: WalletsGen.ValidateSecretKeyPayload, logger) => {
  const {secretKey} = action.payload
  return RPCStellarTypes.localValidateSecretKeyLocalRpcPromise(
    {secretKey: secretKey.stringValue()},
    Constants.validateSecretKeyWaitingKey
  )
    .then(() => WalletsGen.createValidatedSecretKey({secretKey}))
    .catch(err => {
      logger.warn(`Error: ${err.desc}`)
      return WalletsGen.createValidatedSecretKeyError({error: err.desc, secretKey})
    })
}

const deletedAccount = state =>
  WalletsGen.createSelectAccount({
    accountID: state.wallets.accountMap.find(account => account.isDefault).accountID,
    reason: 'auto-selected',
    show: true,
  })

export const hasShowOnCreation = <F, T extends {}, G extends {showOnCreation: F}>(a: T | G): a is G =>
  a && a.hasOwnProperty('showOnCreation')

const createdOrLinkedAccount = (
  state,
  action: WalletsGen.CreatedNewAccountPayload | WalletsGen.LinkedExistingAccountPayload
) => {
  if (actionHasError(action)) {
    // Create new account failed, don't nav
    return
  }
  if (action.payload && hasShowOnCreation(action.payload)) {
    return WalletsGen.createSelectAccount({
      accountID: action.payload.accountID,
      reason: 'auto-selected',
      show: true,
    })
  }
  if (action.payload && typeof action.payload.setBuildingTo) {
    return WalletsGen.createSetBuildingTo({to: action.payload.accountID})
  }
  return RouteTreeGen.createNavigateUp()
}

const navigateUp = (
  state,
  action: WalletsGen.DidSetAccountAsDefaultPayload | WalletsGen.ChangedAccountNamePayload
) => {
  if (actionHasError(action)) {
    // we don't want to nav on error
    return
  }
  return RouteTreeGen.createNavigateUp()
}

const navigateToAccount = (state, action: WalletsGen.SelectAccountPayload): Array<TypedActions> => {
  if (action.type === WalletsGen.selectAccount && !action.payload.show) {
    // we don't want to show, don't nav
    return
  }

  return [
    RouteTreeGen.createClearModals(),
    RouteTreeGen.createResetStack({
      actions: isMobile ? [RouteTreeGen.createNavigateAppend({path: [SettingsConstants.walletsTab]})] : [],
      index: isMobile ? 1 : 0,
      tab: isMobile ? Tabs.settingsTab : Tabs.walletsTab,
    }),
  ]
}

const navigateToTransaction = (state, action: WalletsGen.ShowTransactionPayload) => {
  const {accountID, paymentID} = action.payload
  const actions: Array<TypedActions> = [
    WalletsGen.createSelectAccount({accountID, reason: 'show-transaction'}),
  ]
  actions.push(
    RouteTreeGen.createNavigateAppend({
      path: [{props: {accountID, paymentID}, selected: 'transactionDetails'}],
    })
  )
  return actions
}

const exportSecretKey = (state, action: WalletsGen.ExportSecretKeyPayload) =>
  RPCStellarTypes.localGetWalletAccountSecretKeyLocalRpcPromise({accountID: action.payload.accountID}).then(
    res =>
      WalletsGen.createSecretKeyReceived({
        accountID: action.payload.accountID,
        secretKey: new HiddenString(res),
      })
  )

const maybeSelectDefaultAccount = (state, action: WalletsGen.AccountsReceivedPayload, logger) => {
  if (!state.config.loggedIn) {
    logger.error('not logged in')
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

const cancelPayment = (state, action: WalletsGen.CancelPaymentPayload, logger) => {
  const {paymentID, showAccount} = action.payload
  const pid = Types.paymentIDToString(paymentID)
  logger.info(`cancelling payment with ID ${pid}`)
  return RPCStellarTypes.localCancelPaymentLocalRpcPromise(
    {paymentID: Types.paymentIDToRPCPaymentID(paymentID)},
    Constants.cancelPaymentWaitingKey(paymentID)
  )
    .then(_ => {
      logger.info(`successfully cancelled payment with ID ${pid}`)
      if (showAccount) {
        return WalletsGen.createSelectAccount({
          accountID: Constants.getSelectedAccount(state),
          reason: 'auto-selected',
          show: true,
        })
      }
    })
    .catch(err => {
      logger.error(`failed to cancel payment with ID ${pid}. Error: ${err.message}`)
      throw err
    })
}

const cancelRequest = (state, action: WalletsGen.CancelRequestPayload, logger) =>
  RPCStellarTypes.localCancelRequestLocalRpcPromise({reqID: action.payload.requestID}).catch(err =>
    logger.error(`Error: ${err.message}`)
  )

const maybeNavigateAwayFromSendForm = state => {
  const path = Router2Constants.getModalStack()
  const actions = []
  // pop off any routes that are part of the popup
  path.reverse().some(p => {
    if (Constants.sendRequestFormRoutes.includes(p.routeName)) {
      actions.push(RouteTreeGen.createNavigateUp())
      return false
    }
    // we're done
    return true
  })
  return actions
}

const maybeNavigateToConversation = (state, action: WalletsGen.RequestedPaymentPayload, logger) => {
  logger.info('Navigating to conversation because we requested a payment')
  return Chat2Gen.createPreviewConversation({
    participants: [action.payload.requestee],
    reason: 'requestedPayment',
  })
}

const accountDetailsUpdate = (_, action: EngineGen.Stellar1NotifyAccountDetailsUpdatePayload) =>
  WalletsGen.createAccountUpdateReceived({
    account: Constants.accountResultToAccount(action.payload.params.account),
  })

const accountsUpdate = (_, action: EngineGen.Stellar1NotifyRecentPaymentsUpdatePayload, logger) =>
  WalletsGen.createAccountsReceived({
    // @ts-ignore codemod-issue
    accounts: (action.payload.params.accounts || []).map(account => {
      if (!account.accountID) {
        logger.error(`Found empty accountID, name: ${account.name} isDefault: ${String(account.isDefault)}`)
      }
      return Constants.accountResultToAccount(account)
    }),
  })

const pendingPaymentsUpdate = (_, action: EngineGen.Stellar1NotifyPendingPaymentsUpdatePayload, logger) => {
  const {accountID: _accountID, pending: _pending} = action.payload.params
  if (!_pending) {
    logger.warn(`no pending payments in payload`)
    return
  }
  const accountID = Types.stringToAccountID(_accountID)
  const pending = _pending.map(p => Constants.rpcPaymentResultToPaymentResult(p, 'pending'))
  return WalletsGen.createPendingPaymentsReceived({accountID, pending})
}

const recentPaymentsUpdate = (_, action: EngineGen.Stellar1NotifyRecentPaymentsUpdatePayload) => {
  const {
    accountID,
    firstPage: {payments, cursor, oldestUnread},
  } = action.payload.params
  return WalletsGen.createRecentPaymentsReceived({
    accountID: Types.stringToAccountID(accountID),
    oldestUnread: oldestUnread ? Types.rpcPaymentIDToPaymentID(oldestUnread) : Types.noPaymentID,
    paymentCursor: cursor,
    payments: (payments || [])
      .map(elem => Constants.rpcPaymentResultToPaymentResult(elem, 'history'))
      .filter(Boolean),
  })
}

const paymentReviewed = (_, action: EngineGen.Stellar1UiPaymentReviewedPayload) => {
  const {
    msg: {bid, reviewID, seqno, banners, nextButton},
  } = action.payload.params
  return WalletsGen.createReviewedPaymentReceived({banners, bid, nextButton, reviewID, seqno})
}

// maybe just clear always?
const maybeClearErrors = state => WalletsGen.createClearErrors()

const maybeClearNewTxs = (state, action: RouteTreeGen.SwitchToPayload) => {
  // TODO fix
  // const rootTab = I.List(action.payload.path).first()
  // // If we're leaving from the Wallets tab, and the Wallets tab route
  // // was the main transaction list for an account, clear new txs.
  // if (
  // state.routeTree.previousTab === Constants.rootWalletTab &&
  // rootTab !== Constants.rootWalletTab
  // // Constants.isLookingAtWallet(state.routeTree.routeState)
  // ) {
  // const accountID = state.wallets.selectedAccount
  // if (accountID !== Types.noAccountID) {
  // return WalletsGen.createClearNewPayments({accountID})
  // }
  // }
}

const receivedBadgeState = (state, action: NotificationsGen.ReceivedBadgeStatePayload) =>
  WalletsGen.createBadgesUpdated({accounts: action.payload.badgeState.unreadWalletAccounts || []})

const acceptDisclaimer = state =>
  RPCStellarTypes.localAcceptDisclaimerLocalRpcPromise(undefined, Constants.acceptDisclaimerWaitingKey).catch(
    e => {
      // disclaimer screen handles showing error
      // reset delay state
      return WalletsGen.createResetAcceptingDisclaimer()
    }
  )

const checkDisclaimer = (state, _: WalletsGen.CheckDisclaimerPayload, logger) =>
  RPCStellarTypes.localHasAcceptedDisclaimerLocalRpcPromise()
    .then(accepted => {
      const actions: Array<Action> = [WalletsGen.createWalletDisclaimerReceived({accepted})]
      if (accepted) {
        // in new nav we could be in a modal anywhere in the app right now
        actions.push(RouteTreeGen.createClearModals())
        actions.push(RouteTreeGen.createSwitchTab({tab: isMobile ? Tabs.settingsTab : Tabs.walletsTab}))
        if (isMobile) {
          actions.push(RouteTreeGen.createNavigateAppend({path: [SettingsConstants.walletsTab]}))
        }
      }
      return actions
    })
    .catch(err => logger.error(`Error checking wallet disclaimer: ${err.message}`))

const maybeNavToLinkExisting = (state, action: WalletsGen.CheckDisclaimerPayload) =>
  action.payload.nextScreen === 'linkExisting' &&
  RouteTreeGen.createNavigateTo({
    path: [...Constants.rootWalletPath, ...(isMobile ? ['linkExisting'] : ['wallet', 'linkExisting'])],
  })

const rejectDisclaimer = (state, action: WalletsGen.RejectDisclaimerPayload) =>
  isMobile ? RouteTreeGen.createNavigateUp() : RouteTreeGen.createClearModals()

const loadMobileOnlyMode = (
  state,
  action: WalletsGen.LoadMobileOnlyModePayload | WalletsGen.SelectAccountPayload,
  logger
) => {
  let accountID = action.payload.accountID
  if (!accountID || accountID === Types.noAccountID) {
    logger.warn('invalid account ID, bailing')
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

const changeMobileOnlyMode = (state, action: WalletsGen.ChangeMobileOnlyModePayload) => {
  let accountID = action.payload.accountID
  let f = action.payload.enabled
    ? RPCStellarTypes.localSetAccountMobileOnlyLocalRpcPromise
    : RPCStellarTypes.localSetAccountAllDevicesLocalRpcPromise
  return f({accountID}, Constants.setAccountMobileOnlyWaitingKey(accountID)).then(res => [
    WalletsGen.createLoadedMobileOnlyMode({accountID, enabled: action.payload.enabled}),
    WalletsGen.createLoadMobileOnlyMode({accountID}),
  ])
}

const writeLastSentXLM = (state, action: WalletsGen.SetLastSentXLMPayload, logger) => {
  if (action.payload.writeFile) {
    logger.info(`Writing config stellar.lastSentXLM: ${String(state.wallets.lastSentXLM)}`)
    return RPCTypes.configSetValueRpcPromise({
      path: 'stellar.lastSentXLM',
      value: {b: state.wallets.lastSentXLM, isNull: false},
    }).catch(err => logger.error(`Error: ${err.message}`))
  }
}

const readLastSentXLM = (_, __: ConfigGen.DaemonHandshakeDonePayload, logger) => {
  logger.info(`Reading config`)
  return RPCTypes.configGetValueRpcPromise({path: 'stellar.lastSentXLM'})
    .then(result => {
      const value = !result.isNull && !!result.b
      logger.info(`Successfully read config: ${String(value)}`)
      return WalletsGen.createSetLastSentXLM({lastSentXLM: value, writeFile: false})
    })
    .catch(err => {
      err.message.includes('no such key') ? null : logger.error(`Error reading config: ${err.message}`)
    })
}

const exitFailedPayment = (state, action: WalletsGen.ExitFailedPaymentPayload) => {
  const accountID = state.wallets.builtPayment.from
  return [
    WalletsGen.createAbandonPayment(),
    WalletsGen.createSelectAccount({accountID, reason: 'auto-selected', show: true}),
    WalletsGen.createLoadPayments({accountID}),
  ]
}

const changeAirdrop = (_, action: WalletsGen.ChangeAirdropPayload) =>
  RPCStellarTypes.localAirdropRegisterLocalRpcPromise(
    {register: action.payload.accept},
    Constants.airdropWaitingKey
  ).then(() => WalletsGen.createUpdateAirdropState()) // reload

type AirdropDetailsJSONType = {
  header?: {
    body?: string | null
    title?: string | null
  } | null
  sections?: Array<{
    icon?: string | null
    section?: string | null
    lines?: Array<{
      bullet?: boolean | null
      text?: string | null
    } | null> | null
  } | null> | null
} | null

const updateAirdropDetails = (
  _,
  __: WalletsGen.UpdateAirdropStatePayload | ConfigGen.DaemonHandshakeDonePayload,
  logger
) =>
  RPCStellarTypes.localAirdropDetailsLocalRpcPromise(undefined, Constants.airdropWaitingKey)
    .then(s => {
      const json: AirdropDetailsJSONType = JSON.parse(s)
      return WalletsGen.createUpdatedAirdropDetails({
        details: Constants.makeAirdropDetails({
          header: Constants.makeAirdropDetailsHeader({
            body: (json && json.header && json.header.body) || '',
            title: (json && json.header && json.header.title) || '',
          }),
          sections: I.List(
            ((json && json.sections) || []).map(section =>
              Constants.makeAirdropDetailsSection({
                icon: (section && section.icon) || '',
                lines: I.List(
                  ((section && section.lines) || []).map(l =>
                    Constants.makeAirdropDetailsLine({
                      bullet: (l && l.bullet) || false,
                      text: (l && l.text) || '',
                    })
                  )
                ),
                section: (section && section.section) || '',
              })
            )
          ),
        }),
      })
    })
    .catch(e => {
      logger.info(e)
    })

const updateAirdropState = (
  _,
  __: WalletsGen.UpdateAirdropStatePayload | ConfigGen.DaemonHandshakeDonePayload,
  logger
) =>
  RPCStellarTypes.localAirdropStatusLocalRpcPromise(undefined, Constants.airdropWaitingKey)
    .then(({state, rows}) => {
      let airdropState = 'loading'
      switch (state) {
        case 'accepted':
        case 'qualified':
        case 'unqualified':
          airdropState = state
          break
        default:
          logger.error('Invalid airdropstate', state)
      }

      let airdropQualifications = (rows || []).map(r =>
        Constants.makeAirdropQualification({
          subTitle: r.subtitle || '',
          title: r.title || '',
          valid: r.valid || false,
        })
      )

      // @ts-ignore codemod issue
      return WalletsGen.createUpdatedAirdropState({airdropQualifications, airdropState})
    })
    .catch(e => {
      logger.info(e)
    })

const hideAirdropBanner = (): TypedActions =>
  GregorGen.createUpdateCategory({body: 'true', category: Constants.airdropBannerKey})
const gregorPushState = (_, action: GregorGen.PushStatePayload) =>
  WalletsGen.createUpdateAirdropBannerState({
    show: !action.payload.state.find(i => i.item.category === Constants.airdropBannerKey),
  })

function* walletsSaga(): Saga.SagaGenerator<any, any> {
  yield* Saga.chainAction<WalletsGen.CreateNewAccountPayload>(
    WalletsGen.createNewAccount,
    createNewAccount,
    'createNewAccount'
  )
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
    loadAccounts,
    'loadAccounts'
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
    loadAssets,
    'loadAssets'
  )
  yield* Saga.chainAction(
    [WalletsGen.loadPayments, WalletsGen.selectAccount, WalletsGen.linkedExistingAccount],
    loadPayments,
    'loadPayments'
  )
  yield* Saga.chainAction<WalletsGen.LoadMorePaymentsPayload>(
    WalletsGen.loadMorePayments,
    loadMorePayments,
    'loadMorePayments'
  )
  yield* Saga.chainAction<WalletsGen.DeleteAccountPayload>(
    WalletsGen.deleteAccount,
    deleteAccount,
    'deleteAccount'
  )
  yield* Saga.chainAction<WalletsGen.LoadPaymentDetailPayload>(
    WalletsGen.loadPaymentDetail,
    loadPaymentDetail,
    'loadPaymentDetail'
  )
  yield* Saga.chainAction<WalletsGen.MarkAsReadPayload>(WalletsGen.markAsRead, markAsRead, 'markAsRead')
  yield* Saga.chainAction<WalletsGen.LinkExistingAccountPayload>(
    WalletsGen.linkExistingAccount,
    linkExistingAccount,
    'linkExistingAccount'
  )
  yield* Saga.chainAction<WalletsGen.ValidateAccountNamePayload>(
    WalletsGen.validateAccountName,
    validateAccountName,
    'validateAccountName'
  )
  yield* Saga.chainAction<WalletsGen.ValidateSecretKeyPayload>(
    WalletsGen.validateSecretKey,
    validateSecretKey,
    'validateSecretKey'
  )
  yield* Saga.chainAction<WalletsGen.ExportSecretKeyPayload>(
    WalletsGen.exportSecretKey,
    exportSecretKey,
    'exportSecretKey'
  )
  yield* Saga.chainAction<WalletsGen.LoadDisplayCurrenciesPayload | WalletsGen.OpenSendRequestFormPayload>(
    [WalletsGen.loadDisplayCurrencies, WalletsGen.openSendRequestForm],
    loadDisplayCurrencies,
    'loadDisplayCurrencies'
  )
  yield* Saga.chainAction<WalletsGen.LoadSendAssetChoicesPayload>(
    WalletsGen.loadSendAssetChoices,
    loadSendAssetChoices,
    'loadSendAssetChoices'
  )
  yield* Saga.chainAction<WalletsGen.LoadDisplayCurrencyPayload>(
    WalletsGen.loadDisplayCurrency,
    loadDisplayCurrency,
    'loadDisplayCurrency'
  )
  yield* Saga.chainAction<WalletsGen.LoadInflationDestinationPayload>(
    WalletsGen.loadInflationDestination,
    loadInflationDestination,
    'loadInflationDestination'
  )
  yield* Saga.chainAction<WalletsGen.LoadExternalPartnersPayload>(
    WalletsGen.loadExternalPartners,
    loadExternalPartners,
    'loadExternalPartners'
  )
  yield* Saga.chainAction<WalletsGen.SetInflationDestinationPayload>(
    WalletsGen.setInflationDestination,
    setInflationDestination,
    'setInflationDestination'
  )
  yield* Saga.chainAction<WalletsGen.DisplayCurrencyReceivedPayload>(
    WalletsGen.displayCurrencyReceived,
    refreshAssets,
    'refreshAssets'
  )
  yield* Saga.chainAction<WalletsGen.ChangeDisplayCurrencyPayload>(
    WalletsGen.changeDisplayCurrency,
    changeDisplayCurrency,
    'changeDisplayCurrency'
  )
  yield* Saga.chainAction<WalletsGen.SetAccountAsDefaultPayload>(
    WalletsGen.setAccountAsDefault,
    setAccountAsDefault,
    'setAccountAsDefault'
  )
  yield* Saga.chainAction<WalletsGen.ChangeAccountNamePayload>(
    WalletsGen.changeAccountName,
    changeAccountName,
    'changeAccountName'
  )
  yield* Saga.chainAction<WalletsGen.SelectAccountPayload>(
    WalletsGen.selectAccount,
    navigateToAccount,
    'navigateToAccount'
  )
  yield* Saga.chainAction<WalletsGen.ShowTransactionPayload>(
    WalletsGen.showTransaction,
    navigateToTransaction,
    'navigateToTransaction'
  )
  yield* Saga.chainAction<WalletsGen.DidSetAccountAsDefaultPayload | WalletsGen.ChangedAccountNamePayload>(
    [WalletsGen.didSetAccountAsDefault, WalletsGen.changedAccountName],
    navigateUp,
    'navigateUp'
  )
  yield* Saga.chainAction<WalletsGen.CreatedNewAccountPayload | WalletsGen.LinkedExistingAccountPayload>(
    [WalletsGen.createdNewAccount, WalletsGen.linkedExistingAccount],
    createdOrLinkedAccount,
    'createdOrLinkedAccount'
  )
  yield* Saga.chainAction<WalletsGen.AccountsReceivedPayload>(
    WalletsGen.accountsReceived,
    maybeSelectDefaultAccount,
    'maybeSelectDefaultAccount'
  )

  // We don't call this for publicMemo/secretNote so the button doesn't
  // spinner as you type
  yield* Saga.chainAction<WalletsGen.BuildPaymentPayload>(
    WalletsGen.buildPayment,
    buildPayment,
    'buildPayment'
  )
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
    spawnBuildPayment,
    'spawnBuildPayment'
  )
  yield* Saga.chainAction<WalletsGen.OpenSendRequestFormPayload>(
    WalletsGen.openSendRequestForm,
    openSendRequestForm,
    'openSendRequestForm'
  )
  yield* Saga.chainAction<WalletsGen.ReviewPaymentPayload>(
    WalletsGen.reviewPayment,
    reviewPayment,
    'reviewPayment'
  )
  yield* Saga.chainAction<WalletsGen.OpenSendRequestFormPayload>(
    WalletsGen.openSendRequestForm,
    startPayment,
    'startPayment'
  )
  yield* Saga.chainAction<WalletsGen.AccountsReceivedPayload>(
    WalletsGen.accountsReceived,
    maybePopulateBuildingCurrency,
    'maybePopulateBuildingCurrency'
  )

  yield* Saga.chainAction<WalletsGen.DeletedAccountPayload>(
    WalletsGen.deletedAccount,
    deletedAccount,
    'deletedAccount'
  )

  yield* Saga.chainAction<WalletsGen.SendPaymentPayload>(WalletsGen.sendPayment, sendPayment, 'sendPayment')
  yield* Saga.chainAction<WalletsGen.SentPaymentPayload | WalletsGen.RequestedPaymentPayload>(
    [WalletsGen.sentPayment, WalletsGen.requestedPayment],
    setLastSentXLM,
    'setLastSentXLM'
  )
  yield* Saga.chainAction<WalletsGen.SentPaymentPayload | WalletsGen.RequestedPaymentPayload>(
    [WalletsGen.sentPayment, WalletsGen.requestedPayment],
    clearBuilding,
    'clearBuilding'
  )
  yield* Saga.chainAction<WalletsGen.SentPaymentPayload>(WalletsGen.sentPayment, clearBuiltPayment)
  yield* Saga.chainAction<WalletsGen.SentPaymentPayload | WalletsGen.AbandonPaymentPayload>(
    [WalletsGen.sentPayment, WalletsGen.abandonPayment],
    clearErrors,
    'clearErrors'
  )

  yield* Saga.chainAction<WalletsGen.SentPaymentPayload | WalletsGen.AbandonPaymentPayload>(
    [WalletsGen.abandonPayment, WalletsGen.sentPayment],
    maybeNavigateAwayFromSendForm,
    'maybeNavigateAwayFromSendForm'
  )

  yield* Saga.chainGenerator<WalletsGen.RequestPaymentPayload>(
    WalletsGen.requestPayment,
    requestPayment,
    'requestPayment'
  )
  yield* Saga.chainAction<WalletsGen.RequestedPaymentPayload | WalletsGen.AbandonPaymentPayload>(
    [WalletsGen.requestedPayment, WalletsGen.abandonPayment],
    clearBuiltRequest,
    'clearBuiltRequest'
  )
  yield* Saga.chainAction<WalletsGen.RequestedPaymentPayload>(
    WalletsGen.requestedPayment,
    maybeNavigateToConversation,
    'maybeNavigateToConversation'
  )

  // Effects of abandoning payments
  yield* Saga.chainAction<WalletsGen.AbandonPaymentPayload>(
    WalletsGen.abandonPayment,
    stopPayment,
    'stopPayment'
  )

  yield* Saga.chainAction<WalletsGen.ExitFailedPaymentPayload>(
    WalletsGen.exitFailedPayment,
    exitFailedPayment,
    'exitFailedPayment'
  )
  yield* Saga.chainAction<WalletsGen.CancelRequestPayload>(
    WalletsGen.cancelRequest,
    cancelRequest,
    'cancelRequest'
  )
  yield* Saga.chainAction<WalletsGen.CancelPaymentPayload>(
    WalletsGen.cancelPayment,
    cancelPayment,
    'cancelPayment'
  )

  // Clear some errors on navigateUp, clear new txs on switchTab
  yield* Saga.chainAction<RouteTreeGen.NavigateUpPayload>(
    RouteTreeGen.navigateUp,
    maybeClearErrors,
    'maybeClearErrors'
  )
  // TODO fix
  yield* Saga.chainAction<RouteTreeGen.SwitchToPayload>(
    RouteTreeGen.switchTo,
    maybeClearNewTxs,
    'maybeClearNewTxs'
  )

  yield* Saga.chainAction<NotificationsGen.ReceivedBadgeStatePayload>(
    NotificationsGen.receivedBadgeState,
    receivedBadgeState,
    'receivedBadgeState'
  )

  yield* Saga.chainAction<
    | WalletsGen.LoadAccountsPayload
    | ConfigGen.BootstrapStatusLoadedPayload
    | WalletsGen.LoadWalletDisclaimerPayload
  >(
    [WalletsGen.loadAccounts, ConfigGen.bootstrapStatusLoaded, WalletsGen.loadWalletDisclaimer],
    loadWalletDisclaimer,
    'loadWalletDisclaimer'
  )
  yield* Saga.chainAction<WalletsGen.AcceptDisclaimerPayload>(
    WalletsGen.acceptDisclaimer,
    acceptDisclaimer,
    'acceptDisclaimer'
  )
  yield* Saga.chainAction<WalletsGen.CheckDisclaimerPayload>(
    WalletsGen.checkDisclaimer,
    checkDisclaimer,
    'checkDisclaimer'
  )
  yield* Saga.chainAction<WalletsGen.CheckDisclaimerPayload>(
    WalletsGen.checkDisclaimer,
    maybeNavToLinkExisting,
    'maybeNavToLinkExisting'
  )
  yield* Saga.chainAction<WalletsGen.RejectDisclaimerPayload>(
    WalletsGen.rejectDisclaimer,
    rejectDisclaimer,
    'rejectDisclaimer'
  )

  yield* Saga.chainAction<WalletsGen.LoadMobileOnlyModePayload | WalletsGen.SelectAccountPayload>(
    [WalletsGen.loadMobileOnlyMode, WalletsGen.selectAccount],
    loadMobileOnlyMode,
    'loadMobileOnlyMode'
  )
  yield* Saga.chainAction<WalletsGen.ChangeMobileOnlyModePayload>(
    WalletsGen.changeMobileOnlyMode,
    changeMobileOnlyMode,
    'changeMobileOnlyMode'
  )
  yield* Saga.chainAction<WalletsGen.SetLastSentXLMPayload>(
    WalletsGen.setLastSentXLM,
    writeLastSentXLM,
    'writeLastSentXLM'
  )
  yield* Saga.chainAction<ConfigGen.DaemonHandshakeDonePayload>(
    ConfigGen.daemonHandshakeDone,
    readLastSentXLM,
    'readLastSentXLM'
  )
  yield* Saga.chainAction<EngineGen.Stellar1NotifyAccountDetailsUpdatePayload>(
    EngineGen.stellar1NotifyAccountDetailsUpdate,
    accountDetailsUpdate,
    'accountDetailsUpdate'
  )
  yield* Saga.chainAction(EngineGen.stellar1NotifyAccountsUpdate, accountsUpdate, 'accountsUpdate')
  yield* Saga.chainAction<EngineGen.Stellar1NotifyPendingPaymentsUpdatePayload>(
    EngineGen.stellar1NotifyPendingPaymentsUpdate,
    pendingPaymentsUpdate,
    'pendingPaymentsUpdate'
  )
  yield* Saga.chainAction<EngineGen.Stellar1NotifyRecentPaymentsUpdatePayload>(
    EngineGen.stellar1NotifyRecentPaymentsUpdate,
    recentPaymentsUpdate,
    'recentPaymentsUpdate'
  )
  yield* Saga.chainAction<EngineGen.Stellar1UiPaymentReviewedPayload>(
    EngineGen.stellar1UiPaymentReviewed,
    paymentReviewed,
    'paymentReviewed'
  )

  if (flags.airdrop) {
    yield* Saga.chainAction<GregorGen.PushStatePayload>(
      GregorGen.pushState,
      gregorPushState,
      'gregorPushState'
    )
    yield* Saga.chainAction<WalletsGen.ChangeAirdropPayload>(
      WalletsGen.changeAirdrop,
      changeAirdrop,
      'changeAirdrop'
    )
    yield* Saga.chainAction<WalletsGen.UpdateAirdropStatePayload | ConfigGen.DaemonHandshakeDonePayload>(
      [WalletsGen.updateAirdropDetails, ConfigGen.daemonHandshakeDone],
      updateAirdropDetails,
      'updateAirdropDetails'
    )
    yield* Saga.chainAction<WalletsGen.UpdateAirdropStatePayload | ConfigGen.DaemonHandshakeDonePayload>(
      [WalletsGen.updateAirdropState, ConfigGen.daemonHandshakeDone],
      updateAirdropState,
      'updateAirdropState'
    )
    yield* Saga.chainAction(
      [WalletsGen.hideAirdropBanner, WalletsGen.changeAirdrop],
      hideAirdropBanner,
      'hideAirdropBanner'
    )
  }
}

export default walletsSaga
