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
import openURL from '../util/open-url'
import {isMobile} from '../constants/platform'
import {actionHasError, TypedActions, TypedState} from '../util/container'
import {Action} from 'redux'

const stateToBuildRequestParams = (state: TypedState) => ({
  amount: state.wallets.building.amount,
  currency: state.wallets.building.currency === 'XLM' ? null : state.wallets.building.currency,
  secretNote: state.wallets.building.secretNote.stringValue(),
  to: state.wallets.building.to,
})

const buildErrCatcher = (err: any) => {
  if (err instanceof RPCError && err.code === RPCTypes.StatusCode.sccanceled) {
    // ignore cancellation
  } else {
    logger.error(`buildPayment error: ${err.message}`)
    throw err
  }
}

const buildPayment = (state: TypedState, _: WalletsGen.BuildPaymentPayload) =>
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
  state: TypedState,
  action:
    | WalletsGen.SetBuildingAmountPayload
    | WalletsGen.SetBuildingCurrencyPayload
    | WalletsGen.SetBuildingFromPayload
    | WalletsGen.SetBuildingIsRequestPayload
    | WalletsGen.SetBuildingToPayload
    | WalletsGen.DisplayCurrencyReceivedPayload
    | WalletsGen.BuildingPaymentIDReceivedPayload,
  logger: Saga.SagaLogger
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

const openSendRequestForm = (state: TypedState, _: WalletsGen.OpenSendRequestFormPayload) => {
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

const maybePopulateBuildingCurrency = (state: TypedState, _: WalletsGen.AccountsReceivedPayload) =>
  (state.wallets.building.bid || state.wallets.building.isRequest) && !state.wallets.building.currency // building a payment and haven't set currency yet
    ? WalletsGen.createSetBuildingCurrency({currency: Constants.getDefaultDisplayCurrency(state).code})
    : null

const createNewAccount = (
  _: TypedState,
  action: WalletsGen.CreateNewAccountPayload,
  logger: Saga.SagaLogger
) => {
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

const emptyAsset: RPCStellarTypes.Asset = {
  authEndpoint: '',
  code: '',
  depositButtonText: '',
  desc: '',
  infoUrl: '',
  infoUrlText: '',
  issuer: '',
  issuerName: '',
  showDepositButton: false,
  showWithdrawButton: false,
  transferServer: '',
  type: 'native',
  verifiedDomain: '',
  withdrawButtonText: '',
  withdrawType: '',
}

const emptyAssetWithoutType: RPCStellarTypes.Asset = {
  ...emptyAsset,
  type: '',
}

const sendPayment = (state: TypedState) => {
  const notXLM = state.wallets.building.currency !== '' && state.wallets.building.currency !== 'XLM'
  return RPCStellarTypes.localSendPaymentLocalRpcPromise(
    {
      amount: notXLM ? state.wallets.builtPayment.worthAmount : state.wallets.building.amount,
      asset: emptyAsset,
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
        jumpToChat: res.jumpToChat,
        kbTxID: new HiddenString(res.kbTxID),
        lastSentXLM: !notXLM,
      })
    )
    .catch(err => WalletsGen.createSentPaymentError({error: err.desc}))
}

const setLastSentXLM = (
  _: TypedState,
  action: WalletsGen.SentPaymentPayload | WalletsGen.RequestedPaymentPayload
) =>
  WalletsGen.createSetLastSentXLM({
    lastSentXLM: action.payload.lastSentXLM,
    writeFile: true,
  })

function* requestPayment(state: TypedState, _: WalletsGen.RequestPaymentPayload, logger: Saga.SagaLogger) {
  let buildRes: Saga.RPCPromiseType<typeof RPCStellarTypes.localBuildRequestLocalRpcPromise>
  try {
    buildRes = yield RPCStellarTypes.localBuildRequestLocalRpcPromise(
      stateToBuildRequestParams(state),
      Constants.requestPaymentWaitingKey
    )
  } catch (err) {
    buildErrCatcher(err)
    return null
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
    return null
  }

  const kbRqID: Saga.RPCPromiseType<
    typeof RPCStellarTypes.localMakeRequestLocalRpcPromise
  > = yield RPCStellarTypes.localMakeRequestLocalRpcPromise(
    {
      amount: state.wallets.building.amount,
      // FIXME -- support other assets.
      asset: state.wallets.building.currency === 'XLM' ? emptyAsset : null,
      currency:
        state.wallets.building.currency && state.wallets.building.currency !== 'XLM'
          ? state.wallets.building.currency
          : null,
      note: state.wallets.building.secretNote.stringValue(),
      recipient: state.wallets.building.to,
    },
    Constants.requestPaymentWaitingKey
  )
  const navAction = maybeNavigateAwayFromSendForm()
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

const startPayment = (state: TypedState) =>
  state.wallets.acceptedDisclaimer && !state.wallets.building.isRequest
    ? RPCStellarTypes.localStartBuildPaymentLocalRpcPromise().then(bid =>
        WalletsGen.createBuildingPaymentIDReceived({bid})
      )
    : null

const reviewPayment = (state: TypedState) =>
  RPCStellarTypes.localReviewPaymentLocalRpcPromise({
    bid: state.wallets.building.bid,
    reviewID: state.wallets.reviewCounter,
  }).catch(error => {
    if (error instanceof RPCError && error.code === RPCTypes.StatusCode.sccanceled) {
      // ignore cancellation, which is expected in the case where we have a
      // failing review and then we build or stop a payment
      return undefined
    } else {
      return WalletsGen.createSentPaymentError({error: error.desc})
    }
  })

const stopPayment = (state: TypedState, _: WalletsGen.AbandonPaymentPayload) =>
  RPCStellarTypes.localStopBuildPaymentLocalRpcPromise({bid: state.wallets.building.bid})

const validateSEP7Link = (_: TypedState, action: WalletsGen.ValidateSEP7LinkPayload) =>
  RPCStellarTypes.localValidateStellarURILocalRpcPromise({inputURI: action.payload.link})
    .then(tx => [
      WalletsGen.createSetSEP7Tx({confirmURI: action.payload.link, tx: Constants.makeSEP7ConfirmInfo(tx)}),
      WalletsGen.createValidateSEP7LinkError({error: ''}),
      RouteTreeGen.createClearModals(),
      RouteTreeGen.createNavigateAppend({path: ['sep7Confirm']}),
    ])
    .catch(error => [
      WalletsGen.createValidateSEP7LinkError({
        error: error.desc,
      }),
      RouteTreeGen.createClearModals(),
      RouteTreeGen.createNavigateAppend({
        path: [{props: {errorSource: 'sep7'}, selected: 'keybaseLinkError'}],
      }),
    ])

const acceptSEP7Tx = (_: TypedState, action: WalletsGen.AcceptSEP7TxPayload) =>
  RPCStellarTypes.localApproveTxURILocalRpcPromise(
    {inputURI: action.payload.inputURI},
    Constants.sep7WaitingKey
  ).then(_ => [RouteTreeGen.createClearModals(), RouteTreeGen.createSwitchTab({tab: Tabs.walletsTab})])

const acceptSEP7Path = (state: TypedState, action: WalletsGen.AcceptSEP7PathPayload) =>
  RPCStellarTypes.localApprovePathURILocalRpcPromise(
    {
      fromCLI: false,
      fullPath: paymentPathToRpcPaymentPath(state.wallets.sep7ConfirmPath.fullPath),
      inputURI: action.payload.inputURI,
    },
    Constants.sep7WaitingKey
  ).then(_ => [RouteTreeGen.createClearModals(), RouteTreeGen.createSwitchTab({tab: Tabs.walletsTab})])

const acceptSEP7Pay = (_: TypedState, action: WalletsGen.AcceptSEP7PayPayload) =>
  RPCStellarTypes.localApprovePayURILocalRpcPromise(
    {
      amount: action.payload.amount,
      fromCLI: false,
      inputURI: action.payload.inputURI,
    },
    Constants.sep7WaitingKey
  ).then(_ => [RouteTreeGen.createClearModals(), RouteTreeGen.createSwitchTab({tab: Tabs.walletsTab})])

const clearBuiltPayment = () => WalletsGen.createClearBuiltPayment()
const clearBuiltRequest = () => WalletsGen.createClearBuiltRequest()

const clearBuilding = () => WalletsGen.createClearBuilding()

const clearErrors = () => WalletsGen.createClearErrors()

const loadWalletDisclaimer = (state: TypedState) =>
  !!state.config.username &&
  RPCStellarTypes.localHasAcceptedDisclaimerLocalRpcPromise(undefined, Constants.checkOnlineWaitingKey)
    .then(accepted => WalletsGen.createWalletDisclaimerReceived({accepted}))
    .catch(() => {}) // handled by reloadable

const loadAccounts = (
  state: TypedState,
  action:
    | WalletsGen.LoadAccountsPayload
    | WalletsGen.CreatedNewAccountPayload
    | WalletsGen.LinkedExistingAccountPayload
    | WalletsGen.DeletedAccountPayload,
  logger: Saga.SagaLogger
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
const loadAssets = (state: TypedState, action: LoadAssetsActions, logger: Saga.SagaLogger) => {
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
  return undefined
}

const createPaymentsReceived = (accountID, payments, pending, allowClearOldestUnread) =>
  WalletsGen.createPaymentsReceived({
    accountID,
    allowClearOldestUnread,
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
const loadPayments = (state, action: LoadPaymentsActions, logger: Saga.SagaLogger) => {
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
    ]).then(([pending, payments]) =>
      createPaymentsReceived(action.payload.accountID, payments, pending, true)
    )
  )
}

const loadMorePayments = (
  state: TypedState,
  action: WalletsGen.LoadMorePaymentsPayload,
  logger: Saga.SagaLogger
) => {
  if (!state.config.loggedIn) {
    logger.error('not logged in')
    return
  }
  const cursor = state.wallets.paymentCursorMap.get(action.payload.accountID)
  return (
    cursor &&
    RPCStellarTypes.localGetPaymentsLocalRpcPromise({accountID: action.payload.accountID, cursor}).then(
      payments => createPaymentsReceived(action.payload.accountID, payments, [], false)
    )
  )
}

// We only need to load these once per session
const loadDisplayCurrencies = (state: TypedState) =>
  !Constants.displayCurrenciesLoaded(state) &&
  RPCStellarTypes.localGetDisplayCurrenciesLocalRpcPromise().then(res =>
    WalletsGen.createDisplayCurrenciesReceived({
      currencies: (res || []).map(c => Constants.currencyResultToCurrency(c)),
    })
  )

const loadSendAssetChoices = (_: TypedState, action: WalletsGen.LoadSendAssetChoicesPayload) =>
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

const loadDisplayCurrency = (_: TypedState, action: WalletsGen.LoadDisplayCurrencyPayload) => {
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

const loadInflationDestination = (_: TypedState, action: WalletsGen.LoadInflationDestinationPayload) => {
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
    WalletsGen.createExternalPartnersReceived({externalPartners: I.List(partners || [])})
  )

const refreshAssets = (_: TypedState, action: WalletsGen.DisplayCurrencyReceivedPayload) =>
  action.payload.accountID ? WalletsGen.createLoadAssets({accountID: action.payload.accountID}) : undefined

const changeDisplayCurrency = (_: TypedState, action: WalletsGen.ChangeDisplayCurrencyPayload) =>
  RPCStellarTypes.localChangeDisplayCurrencyLocalRpcPromise(
    {
      accountID: action.payload.accountID,
      currency: action.payload.code, // called currency, though it is a code
    },
    Constants.changeDisplayCurrencyWaitingKey
  ).then(currencyRes => {
    WalletsGen.createDisplayCurrencyReceived({
      accountID: action.payload.accountID,
      currency: Constants.makeCurrency(currencyRes),
      setBuildingCurrency: false,
    })
  })

const changeAccountName = (_: TypedState, action: WalletsGen.ChangeAccountNamePayload) =>
  RPCStellarTypes.localChangeWalletAccountNameLocalRpcPromise(
    {
      accountID: action.payload.accountID,
      newName: action.payload.name,
    },
    Constants.changeAccountNameWaitingKey
  ).then(res => WalletsGen.createChangedAccountName({account: Constants.accountResultToAccount(res)}))

const deleteAccount = (_: TypedState, action: WalletsGen.DeleteAccountPayload) =>
  RPCStellarTypes.localDeleteWalletAccountLocalRpcPromise(
    {
      accountID: action.payload.accountID,
      userAcknowledged: 'yes',
    },
    Constants.deleteAccountWaitingKey
  ).then(() => WalletsGen.createDeletedAccount())

const setAccountAsDefault = (_: TypedState, action: WalletsGen.SetAccountAsDefaultPayload) =>
  RPCStellarTypes.localSetWalletAccountAsDefaultLocalRpcPromise(
    {accountID: action.payload.accountID},
    Constants.setAccountAsDefaultWaitingKey
  ).then(accountsAfterUpdate =>
    WalletsGen.createDidSetAccountAsDefault({
      accounts: (accountsAfterUpdate || []).map(account => {
        if (!account.accountID) {
          logger.error(`Found empty accountID, name: ${account.name} isDefault: ${String(account.isDefault)}`)
        }
        return Constants.accountResultToAccount(account)
      }),
    })
  )

const loadPaymentDetail = (
  _: TypedState,
  action: WalletsGen.LoadPaymentDetailPayload,
  logger: Saga.SagaLogger
) =>
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

const markAsRead = (_: TypedState, action: WalletsGen.MarkAsReadPayload, logger: Saga.SagaLogger) =>
  RPCStellarTypes.localMarkAsReadLocalRpcPromise({
    accountID: action.payload.accountID,
    mostRecentID: Types.paymentIDToRPCPaymentID(action.payload.mostRecentID),
  }).catch(err => {
    // No need to throw black bars.
    logger.warn(err.desc)
  })

const linkExistingAccount = (
  _: TypedState,
  action: WalletsGen.LinkExistingAccountPayload,
  logger: Saga.SagaLogger
) => {
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

const validateAccountName = (
  _: TypedState,
  action: WalletsGen.ValidateAccountNamePayload,
  logger: Saga.SagaLogger
) => {
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

const validateSecretKey = (
  _: TypedState,
  action: WalletsGen.ValidateSecretKeyPayload,
  logger: Saga.SagaLogger
) => {
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

const deletedAccount = (state: TypedState) => {
  const a = state.wallets.accountMap.find(account => account.isDefault)
  return (
    a &&
    WalletsGen.createSelectAccount({
      accountID: a.accountID,
      reason: 'auto-selected',
      show: true,
    })
  )
}

export const hasShowOnCreation = <F, T extends {}, G extends {showOnCreation: F}>(a: T | G): a is G =>
  a && Object.prototype.hasOwnProperty.call(a, 'showOnCreation')

const createdOrLinkedAccount = (
  _: TypedState,
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
  _: TypedState,
  action: WalletsGen.DidSetAccountAsDefaultPayload | WalletsGen.ChangedAccountNamePayload
) => {
  if (actionHasError(action)) {
    // we don't want to nav on error
    return
  }
  return RouteTreeGen.createNavigateUp()
}

const navigateToAccount = (_: TypedState, action: WalletsGen.SelectAccountPayload) => {
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

const navigateToTransaction = (_: TypedState, action: WalletsGen.ShowTransactionPayload) => {
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

const exportSecretKey = (_: TypedState, action: WalletsGen.ExportSecretKeyPayload) =>
  RPCStellarTypes.localGetWalletAccountSecretKeyLocalRpcPromise({accountID: action.payload.accountID}).then(
    res =>
      WalletsGen.createSecretKeyReceived({
        accountID: action.payload.accountID,
        secretKey: new HiddenString(res),
      })
  )

const maybeSelectDefaultAccount = (
  state: TypedState,
  _: WalletsGen.AccountsReceivedPayload,
  logger: Saga.SagaLogger
) => {
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
  return undefined
}

const cancelPayment = (
  state: TypedState,
  action: WalletsGen.CancelPaymentPayload,
  logger: Saga.SagaLogger
) => {
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
      return undefined
    })
    .catch(err => {
      logger.error(`failed to cancel payment with ID ${pid}. Error: ${err.message}`)
      throw err
    })
}

const cancelRequest = (_: TypedState, action: WalletsGen.CancelRequestPayload, logger: Saga.SagaLogger) =>
  RPCStellarTypes.localCancelRequestLocalRpcPromise({reqID: action.payload.requestID}).catch(err =>
    logger.error(`Error: ${err.message}`)
  )

const maybeNavigateAwayFromSendForm = () => {
  const path = Router2Constants.getModalStack()
  const actions: Array<TypedActions> = []
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

const maybeNavigateToConversationFromPayment = (
  _: TypedState,
  action: WalletsGen.SentPaymentPayload,
  logger: Saga.SagaLogger
) => {
  const actions = maybeNavigateAwayFromSendForm()
  if (action.payload.jumpToChat) {
    logger.info('Navigating to conversation because we sent a payment')
    actions.push(
      Chat2Gen.createPreviewConversation({
        participants: [action.payload.jumpToChat],
        reason: 'sentPayment',
      })
    )
  }
  return actions
}

const maybeNavigateToConversationFromRequest = (
  _: TypedState,
  action: WalletsGen.RequestedPaymentPayload,
  logger: Saga.SagaLogger
) => {
  logger.info('Navigating to conversation because we requested a payment')
  return Chat2Gen.createPreviewConversation({
    participants: [action.payload.requestee],
    reason: 'requestedPayment',
  })
}

const accountDetailsUpdate = (_: TypedState, action: EngineGen.Stellar1NotifyAccountDetailsUpdatePayload) =>
  WalletsGen.createAccountUpdateReceived({
    account: Constants.accountResultToAccount(action.payload.params.account),
  })

const accountsUpdate = (
  _: TypedState,
  action: EngineGen.Stellar1NotifyAccountsUpdatePayload,
  logger: Saga.SagaLogger
) =>
  WalletsGen.createAccountsReceived({
    accounts: (action.payload.params.accounts || []).map(account => {
      if (!account.accountID) {
        logger.error(`Found empty accountID, name: ${account.name} isDefault: ${String(account.isDefault)}`)
      }
      return Constants.accountResultToAccount(account)
    }),
  })

const pendingPaymentsUpdate = (
  _: TypedState,
  action: EngineGen.Stellar1NotifyPendingPaymentsUpdatePayload,
  logger: Saga.SagaLogger
) => {
  const {accountID: _accountID, pending: _pending} = action.payload.params
  if (!_pending) {
    logger.warn(`no pending payments in payload`)
    return
  }
  const accountID = Types.stringToAccountID(_accountID)
  const pending = _pending.map(p => Constants.rpcPaymentResultToPaymentResult(p, 'pending'))
  return WalletsGen.createPendingPaymentsReceived({accountID, pending})
}

const recentPaymentsUpdate = (_: TypedState, action: EngineGen.Stellar1NotifyRecentPaymentsUpdatePayload) => {
  const {
    accountID,
    firstPage: {payments, cursor, oldestUnread},
  } = action.payload.params
  return WalletsGen.createRecentPaymentsReceived({
    accountID: Types.stringToAccountID(accountID),
    oldestUnread: oldestUnread ? Types.rpcPaymentIDToPaymentID(oldestUnread) : Types.noPaymentID,
    paymentCursor: cursor || null,
    payments: (payments || [])
      .map(elem => Constants.rpcPaymentResultToPaymentResult(elem, 'history'))
      .filter(Boolean),
  })
}

const paymentReviewed = (_: TypedState, action: EngineGen.Stellar1UiPaymentReviewedPayload) => {
  const {
    msg: {bid, reviewID, seqno, banners, nextButton},
  } = action.payload.params
  return WalletsGen.createReviewedPaymentReceived({banners, bid, nextButton, reviewID, seqno})
}

// maybe just clear always?
const maybeClearErrors = (_: TypedState) => WalletsGen.createClearErrors()

const receivedBadgeState = (_: TypedState, action: NotificationsGen.ReceivedBadgeStatePayload) =>
  WalletsGen.createBadgesUpdated({accounts: action.payload.badgeState.unreadWalletAccounts || []})

const acceptDisclaimer = (_: TypedState) =>
  RPCStellarTypes.localAcceptDisclaimerLocalRpcPromise(undefined, Constants.acceptDisclaimerWaitingKey).catch(
    () => {
      // disclaimer screen handles showing error
      // reset delay state
      return WalletsGen.createResetAcceptingDisclaimer()
    }
  )

const checkDisclaimer = (_: TypedState, action: WalletsGen.CheckDisclaimerPayload, logger: Saga.SagaLogger) =>
  RPCStellarTypes.localHasAcceptedDisclaimerLocalRpcPromise()
    .then(accepted => {
      const actions: Array<Action> = [WalletsGen.createWalletDisclaimerReceived({accepted})]
      if (accepted) {
        // in new nav we could be in a modal anywhere in the app right now
        actions.push(RouteTreeGen.createClearModals())
        actions.push(RouteTreeGen.createSwitchTab({tab: isMobile ? Tabs.settingsTab : Tabs.walletsTab}))
        if (isMobile) {
          if (action.payload.nextScreen === 'airdrop') {
            actions.push(
              RouteTreeGen.createNavigateAppend({
                path: [...Constants.rootWalletPath, ...(isMobile ? ['airdrop'] : ['wallet', 'airdrop'])],
              })
            )
          } else {
            actions.push(RouteTreeGen.createNavigateAppend({path: [SettingsConstants.walletsTab]}))
          }
        }
      }
      return actions
    })
    .catch(err => logger.error(`Error checking wallet disclaimer: ${err.message}`))

const rejectDisclaimer = (_: TypedState, __: WalletsGen.RejectDisclaimerPayload) =>
  isMobile ? RouteTreeGen.createNavigateUp() : RouteTreeGen.createSwitchTab({tab: Tabs.peopleTab})

const loadMobileOnlyMode = (
  _: TypedState,
  action: WalletsGen.LoadMobileOnlyModePayload | WalletsGen.SelectAccountPayload,
  logger: Saga.SagaLogger
) => {
  let accountID = action.payload.accountID
  if (!accountID || accountID === Types.noAccountID) {
    logger.warn('invalid account ID, bailing')
    return
  }
  return RPCStellarTypes.localIsAccountMobileOnlyLocalRpcPromise({
    accountID,
  })
    .then(isMobileOnly =>
      WalletsGen.createLoadedMobileOnlyMode({
        accountID: accountID,
        enabled: isMobileOnly,
      })
    )
    .catch(err => handleSelectAccountError(action, 'loading mobile only mode', err))
}

const changeMobileOnlyMode = (_: TypedState, action: WalletsGen.ChangeMobileOnlyModePayload) => {
  let accountID = action.payload.accountID
  let f = action.payload.enabled
    ? RPCStellarTypes.localSetAccountMobileOnlyLocalRpcPromise
    : RPCStellarTypes.localSetAccountAllDevicesLocalRpcPromise
  return f({accountID}, Constants.setAccountMobileOnlyWaitingKey(accountID)).then(() =>
    WalletsGen.createLoadedMobileOnlyMode({
      accountID: accountID,
      enabled: action.payload.enabled,
    })
  )
}

const writeLastSentXLM = (
  state: TypedState,
  action: WalletsGen.SetLastSentXLMPayload,
  logger: Saga.SagaLogger
) => {
  if (action.payload.writeFile) {
    logger.info(`Writing config stellar.lastSentXLM: ${String(state.wallets.lastSentXLM)}`)
    return RPCTypes.configGuiSetValueRpcPromise({
      path: 'stellar.lastSentXLM',
      value: {b: state.wallets.lastSentXLM, isNull: false},
    }).catch(err => logger.error(`Error: ${err.message}`))
  }
  return undefined
}

const readLastSentXLM = (
  _: TypedState,
  __: ConfigGen.DaemonHandshakeDonePayload,
  logger: Saga.SagaLogger
) => {
  logger.info(`Reading config`)
  return RPCTypes.configGuiGetValueRpcPromise({path: 'stellar.lastSentXLM'})
    .then(result => {
      const value = !result.isNull && !!result.b
      logger.info(`Successfully read config: ${String(value)}`)
      return WalletsGen.createSetLastSentXLM({lastSentXLM: value, writeFile: false})
    })
    .catch(err => {
      err.message.includes('no such key') ? null : logger.error(`Error reading config: ${err.message}`)
    })
}

const exitFailedPayment = (state: TypedState, _: WalletsGen.ExitFailedPaymentPayload) => {
  const accountID = state.wallets.builtPayment.from
  return [
    WalletsGen.createAbandonPayment(),
    WalletsGen.createSelectAccount({accountID, reason: 'auto-selected', show: true}),
    WalletsGen.createLoadPayments({accountID}),
  ]
}

const changeAirdrop = (_: TypedState, action: WalletsGen.ChangeAirdropPayload) =>
  RPCStellarTypes.localAirdropRegisterLocalRpcPromise(
    {register: action.payload.accept},
    Constants.airdropWaitingKey
  ).then(() => WalletsGen.createUpdateAirdropState()) // reload

const updateAirdropDetails = (
  state: TypedState,
  _:
    | WalletsGen.UpdateAirdropDetailsPayload
    | ConfigGen.DaemonHandshakeDonePayload
    | ConfigGen.LoggedInPayload,
  logger: Saga.SagaLogger
) =>
  state.config.loggedIn &&
  RPCStellarTypes.localAirdropDetailsLocalRpcPromise(undefined, Constants.airdropWaitingKey)
    .then(response => {
      const details: Constants.StellarDetailsJSONType = JSON.parse(response.details)
      const disclaimer: Constants.StellarDetailsJSONType = JSON.parse(response.disclaimer)
      return WalletsGen.createUpdatedAirdropDetails({
        details: Constants.makeStellarDetailsFromJSON(details),
        disclaimer: Constants.makeStellarDetailsFromJSON(disclaimer),
        isPromoted: response.isPromoted,
      })
    })
    .catch(e => {
      logger.info(e)
    })

const updateAirdropState = (
  state: TypedState,
  _: WalletsGen.UpdateAirdropStatePayload | ConfigGen.DaemonHandshakeDonePayload | ConfigGen.LoggedInPayload,
  logger: Saga.SagaLogger
) =>
  state.config.loggedIn &&
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
      if (e.name === 'STELLAR_NEED_DISCLAIMER') {
        return WalletsGen.createUpdatedAirdropState({
          airdropQualifications: [],
          airdropState: 'needDisclaimer',
        })
      }
      return undefined
    })

const hideAirdropBanner = (): TypedActions =>
  GregorGen.createUpdateCategory({body: 'true', category: Constants.airdropBannerKey})
const gregorPushState = (_: TypedState, action: GregorGen.PushStatePayload) =>
  WalletsGen.createUpdateAirdropBannerState({
    show: !action.payload.state.find(i => i.item.category === Constants.airdropBannerKey),
  })

const assetDescriptionOrNativeToRpcAsset = (
  asset: 'native' | Types.AssetDescription
): RPCStellarTypes.Asset => ({
  authEndpoint: '',
  code: asset === 'native' ? '' : asset.code,
  depositButtonText: '',
  desc: '',
  infoUrl: '',
  infoUrlText: '',
  issuer: asset === 'native' ? '' : asset.issuerAccountID,
  issuerName: '',
  showDepositButton: false,
  showWithdrawButton: false,
  transferServer: '',
  type: asset === 'native' ? 'native' : asset.code.length > 4 ? 'credit_alphanum12' : 'credit_alphanum4',
  verifiedDomain: asset === 'native' ? '' : asset.issuerVerifiedDomain,
  withdrawButtonText: '',
  withdrawType: '',
})

const rpcAssetToAssetDescriptionOrNative = (asset: RPCStellarTypes.Asset): Types.AssetDescriptionOrNative =>
  asset.type === 'native'
    ? 'native'
    : Constants.makeAssetDescription({
        code: asset.code,
        depositButtonText: asset.depositButtonText,
        infoUrl: asset.infoUrl,
        infoUrlText: asset.infoUrlText,
        issuerAccountID: asset.issuer,
        issuerName: asset.issuerName,
        issuerVerifiedDomain: asset.verifiedDomain,
        showDepositButton: asset.showDepositButton,
        showWithdrawButton: asset.showWithdrawButton,
        withdrawButtonText: asset.withdrawButtonText,
      })

const balancesToAction = (
  balances: Array<RPCStellarTypes.Balance>,
  accountID: Types.AccountID,
  username: string
) => {
  const {assets, limitsMutable} = balances.reduce(
    // @ts-ignore TODO fix reduce type here
    ({assets, limitsMutable}, balance) => {
      const assetDescriptionOrNative = rpcAssetToAssetDescriptionOrNative(balance.asset)
      return assetDescriptionOrNative === 'native'
        ? {assets, limitsMutable}
        : {
            assets: [...assets, assetDescriptionOrNative],
            limitsMutable: limitsMutable.set(
              Types.assetDescriptionToAssetID(assetDescriptionOrNative),
              Number.parseFloat(balance.limit) || 0
            ),
          }
    },
    {assets: [], limitsMutable: I.Map<Types.AssetID, number>().asMutable()}
  )
  return [
    ...(accountID !== Types.noAccountID
      ? [
          WalletsGen.createSetTrustlineAcceptedAssets({
            accountID,
            assets,
            limits: limitsMutable.asImmutable(),
          }),
        ]
      : []),
    ...(username
      ? [
          WalletsGen.createSetTrustlineAcceptedAssetsByUsername({
            assets,
            limits: limitsMutable.asImmutable(),
            username,
          }),
        ]
      : []),
  ]
}

const refreshTrustlineAcceptedAssets = (_: TypedState, {payload: {accountID}}) =>
  accountID !== Types.noAccountID &&
  RPCStellarTypes.localGetTrustlinesLocalRpcPromise(
    {accountID},
    Constants.refreshTrustlineAcceptedAssetsWaitingKey(accountID)
  ).then(balances => balancesToAction(balances || [], accountID, ''))

const refreshTrustlineAcceptedAssetsByUsername = (_: TypedState, {payload: {username}}) =>
  !!username &&
  RPCStellarTypes.localGetTrustlinesForRecipientLocalRpcPromise(
    {recipient: username},
    Constants.refreshTrustlineAcceptedAssetsWaitingKey(username)
  ).then(({trustlines}) => balancesToAction(trustlines || [], Types.noAccountID, username))

const refreshTrustlinePopularAssets = () =>
  RPCStellarTypes.localListPopularAssetsLocalRpcPromise().then(({assets, totalCount}) =>
    WalletsGen.createSetTrustlinePopularAssets({
      assets: assets
        ? (assets
            .map((asset: RPCStellarTypes.Asset) => rpcAssetToAssetDescriptionOrNative(asset))
            .filter(asset => asset !== 'native') as Array<Types.AssetDescription>)
        : [],
      totalCount,
    })
  )

const addTrustline = (state: TypedState, {payload: {accountID, assetID}}) => {
  const asset = state.wallets.trustline.assetMap.get(assetID, Constants.emptyAssetDescription)
  const refresh = WalletsGen.createRefreshTrustlineAcceptedAssets({accountID})
  return (
    asset !== Constants.emptyAssetDescription &&
    RPCStellarTypes.localAddTrustlineLocalRpcPromise(
      {
        accountID: accountID,
        limit: '',
        trustline: {assetCode: asset.code, issuer: asset.issuerAccountID},
      },
      Constants.addTrustlineWaitingKey(accountID, assetID)
    )
      .then(() => [WalletsGen.createChangedTrustline(), refresh])
      .catch(err => {
        logger.warn(`Error: ${err.desc}`)
        return [WalletsGen.createChangedTrustlineError({error: err.desc}), refresh]
      })
  )
}

const deleteTrustline = (state: TypedState, {payload: {accountID, assetID}}) => {
  const asset = state.wallets.trustline.assetMap.get(assetID, Constants.emptyAssetDescription)
  const refresh = WalletsGen.createRefreshTrustlineAcceptedAssets({accountID})
  return (
    asset !== Constants.emptyAssetDescription &&
    RPCStellarTypes.localDeleteTrustlineLocalRpcPromise(
      {
        accountID: accountID,
        trustline: {assetCode: asset.code, issuer: asset.issuerAccountID},
      },
      Constants.deleteTrustlineWaitingKey(accountID, assetID)
    )
      .then(() => [WalletsGen.createChangedTrustline(), refresh])
      .catch(err => {
        logger.warn(`Error: ${err.desc}`)
        return [WalletsGen.createChangedTrustlineError({error: err.desc}), refresh]
      })
  )
}

let lastSearchText = ''
const searchTrustlineAssets = (_: TypedState, {payload: {text}}) => {
  lastSearchText = text
  return text
    ? RPCStellarTypes.localFuzzyAssetSearchLocalRpcPromise(
        {searchString: text},
        Constants.searchTrustlineAssetsWaitingKey
      ).then(
        assets =>
          text === lastSearchText &&
          WalletsGen.createSetTrustlineSearchResults({
            assets: assets
              ? (assets
                  .map(rpcAsset => rpcAssetToAssetDescriptionOrNative(rpcAsset))
                  .filter(asset => asset !== 'native') as Array<Types.AssetDescription>)
              : [],
          })
      )
    : WalletsGen.createClearTrustlineSearchResults()
}

const paymentPathToRpcPaymentPath = (paymentPath: Types.PaymentPath): RPCStellarTypes.PaymentPath => ({
  destinationAmount: paymentPath.destinationAmount,
  destinationAsset: assetDescriptionOrNativeToRpcAsset(paymentPath.destinationAsset),
  path: paymentPath.path.toArray().map(ad => assetDescriptionOrNativeToRpcAsset(ad)),
  sourceAmount: paymentPath.sourceAmount,
  sourceAmountMax: paymentPath.sourceAmountMax,
  sourceAsset: assetDescriptionOrNativeToRpcAsset(paymentPath.sourceAsset),
  sourceInsufficientBalance: paymentPath.sourceInsufficientBalance,
})

const rpcPaymentPathToPaymentPath = (rpcPaymentPath: RPCStellarTypes.PaymentPath) =>
  Constants.makePaymentPath({
    destinationAmount: rpcPaymentPath.destinationAmount,
    destinationAsset: rpcAssetToAssetDescriptionOrNative(rpcPaymentPath.destinationAsset),
    path: I.List(
      rpcPaymentPath.path
        ? rpcPaymentPath.path.map(rpcAsset => rpcAssetToAssetDescriptionOrNative(rpcAsset))
        : []
    ),
    sourceAmount: rpcPaymentPath.sourceAmount,
    sourceAmountMax: rpcPaymentPath.sourceAmountMax,
    sourceAsset: rpcAssetToAssetDescriptionOrNative(rpcPaymentPath.sourceAsset),
    sourceInsufficientBalance: rpcPaymentPath.sourceInsufficientBalance,
  })

const calculateBuildingAdvanced = (
  state: TypedState,
  action: WalletsGen.CalculateBuildingAdvancedPayload
) => {
  const {forSEP7} = action.payload
  let amount = state.wallets.buildingAdvanced.recipientAmount
  let destinationAsset = assetDescriptionOrNativeToRpcAsset(state.wallets.buildingAdvanced.recipientAsset)
  let from = state.wallets.buildingAdvanced.senderAccountID
  let sourceAsset = assetDescriptionOrNativeToRpcAsset(state.wallets.buildingAdvanced.senderAsset)
  let to = state.wallets.buildingAdvanced.recipient

  if (forSEP7) {
    if (state.wallets.sep7ConfirmInfo == null) {
      console.warn('Tried to calculate SEP7 path payment with no SEP7 info')
      return
    }
    amount = state.wallets.sep7ConfirmInfo.amount
    destinationAsset = assetDescriptionOrNativeToRpcAsset(
      Constants.makeAssetDescription({
        code: state.wallets.sep7ConfirmInfo.assetCode,
        issuerAccountID: state.wallets.sep7ConfirmInfo.assetIssuer,
      })
    )
    from = ''
    sourceAsset = emptyAssetWithoutType
    to = state.wallets.sep7ConfirmInfo.recipient
  }

  return RPCStellarTypes.localFindPaymentPathLocalRpcPromise(
    {
      amount,
      destinationAsset,
      from,
      sourceAsset,
      to,
    },
    Constants.calculateBuildingAdvancedWaitingKey
  )
    .then(res => {
      const {
        amountError,
        destinationAccount,
        destinationDisplay,
        exchangeRate,
        fullPath,
        sourceDisplay,
        sourceMaxDisplay,
      } = res
      return WalletsGen.createSetBuiltPaymentAdvanced({
        builtPaymentAdvanced: Constants.makeBuiltPaymentAdvanced({
          amountError,
          destinationAccount,
          destinationDisplay,
          exchangeRate,
          findPathError: '',
          fullPath: rpcPaymentPathToPaymentPath(fullPath),
          readyToSend: !amountError,
          sourceDisplay,
          sourceMaxDisplay,
        }),
        forSEP7: action.payload.forSEP7,
      })
    })
    .catch(err => {
      let errorMessage = 'Error finding a path to convert these 2 assets.'
      if (err && err.desc) {
        errorMessage = err.desc
      }
      if (err && err.code === RPCTypes.StatusCode.scapinetworkerror) {
        errorMessage = 'Network error.'
      }
      if (err && err.desc === 'no payment path found') {
        errorMessage = 'No path was found to convert these 2 assets. Please pick other assets.'
      }
      return WalletsGen.createSetBuiltPaymentAdvanced({
        builtPaymentAdvanced: Constants.makeBuiltPaymentAdvanced({
          findPathError: errorMessage,
          readyToSend: false,
        }),
        forSEP7: action.payload.forSEP7,
      })
    })
}

const sendPaymentAdvanced = (state: TypedState) =>
  RPCStellarTypes.localSendPathLocalRpcPromise(
    {
      note: state.wallets.buildingAdvanced.secretNote.stringValue(),
      path: paymentPathToRpcPaymentPath(state.wallets.builtPaymentAdvanced.fullPath),
      publicNote: state.wallets.buildingAdvanced.publicMemo.stringValue(),
      recipient: state.wallets.buildingAdvanced.recipient,
      source: state.wallets.buildingAdvanced.senderAccountID,
    },
    Constants.sendPaymentAdvancedWaitingKey
  ).then(res =>
    WalletsGen.createSentPayment({
      jumpToChat: res.jumpToChat,
      kbTxID: new HiddenString(res.kbTxID),
      lastSentXLM: false,
    })
  )

const handleSEP6Result = (res: RPCStellarTypes.AssetActionResultLocal) => {
  if (res.externalUrl) {
    return openURL(res.externalUrl)
  }
  if (res.messageFromAnchor) {
    return [
      WalletsGen.createSetSEP6Message({error: false, message: res.messageFromAnchor}),
      RouteTreeGen.createClearModals(),
      RouteTreeGen.createNavigateAppend({
        path: [{props: {errorSource: 'sep6'}, selected: 'keybaseLinkError'}],
      }),
    ]
  }
  console.warn('SEP6 result without Url or Message', res)
  return null
}

const handleSEP6Error = (err: RPCError) => [
  WalletsGen.createSetSEP6Message({error: true, message: err.desc}),
  RouteTreeGen.createClearModals(),
  RouteTreeGen.createNavigateAppend({
    path: [{props: {errorSource: 'sep6'}, selected: 'keybaseLinkError'}],
  }),
]

const assetDeposit = (_: TypedState, action: WalletsGen.AssetDepositPayload) =>
  RPCStellarTypes.localAssetDepositLocalRpcPromise(
    {
      accountID: action.payload.accountID,
      asset: assetDescriptionOrNativeToRpcAsset(
        Constants.makeAssetDescription({
          code: action.payload.code,
          issuerAccountID: action.payload.issuerAccountID,
        })
      ),
    },
    Constants.assetDepositWaitingKey(action.payload.issuerAccountID, action.payload.code)
  )
    .then(res => handleSEP6Result(res))
    .catch(err => handleSEP6Error(err))

const assetWithdraw = (_: TypedState, action: WalletsGen.AssetWithdrawPayload) =>
  RPCStellarTypes.localAssetWithdrawLocalRpcPromise(
    {
      accountID: action.payload.accountID,
      asset: assetDescriptionOrNativeToRpcAsset(
        Constants.makeAssetDescription({
          code: action.payload.code,
          issuerAccountID: action.payload.issuerAccountID,
        })
      ),
    },
    Constants.assetWithdrawWaitingKey(action.payload.issuerAccountID, action.payload.code)
  )
    .then(res => handleSEP6Result(res))
    .catch(err => handleSEP6Error(err))

function* loadStaticConfig(state: TypedState, action: ConfigGen.DaemonHandshakePayload) {
  if (state.wallets.staticConfig) {
    return
  }
  yield Saga.put(
    ConfigGen.createDaemonHandshakeWait({
      increment: true,
      name: 'wallets.loadStatic',
      version: action.payload.version,
    })
  )
  const loadAction = yield RPCStellarTypes.localGetStaticConfigLocalRpcPromise().then(res =>
    WalletsGen.createStaticConfigLoaded({
      staticConfig: I.Record(res)(),
    })
  )

  if (loadAction) {
    yield Saga.put(loadAction)
  }
  yield Saga.put(
    ConfigGen.createDaemonHandshakeWait({
      increment: false,
      name: 'wallets.loadStatic',
      version: action.payload.version,
    })
  )
}

function* walletsSaga(): Saga.SagaGenerator<any, any> {
  yield* Saga.chainAction2(WalletsGen.createNewAccount, createNewAccount, 'createNewAccount')
  yield* Saga.chainAction2(
    [
      WalletsGen.loadAccounts,
      WalletsGen.createdNewAccount,
      WalletsGen.linkedExistingAccount,
      WalletsGen.deletedAccount,
    ],
    loadAccounts,
    'loadAccounts'
  )
  yield* Saga.chainAction2(
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
  yield* Saga.chainAction2(
    [WalletsGen.loadPayments, WalletsGen.selectAccount, WalletsGen.linkedExistingAccount],
    loadPayments,
    'loadPayments'
  )
  yield* Saga.chainAction2(WalletsGen.loadMorePayments, loadMorePayments, 'loadMorePayments')
  yield* Saga.chainAction2(WalletsGen.deleteAccount, deleteAccount, 'deleteAccount')
  yield* Saga.chainAction2(WalletsGen.loadPaymentDetail, loadPaymentDetail, 'loadPaymentDetail')
  yield* Saga.chainAction2(WalletsGen.markAsRead, markAsRead, 'markAsRead')
  yield* Saga.chainAction2(WalletsGen.linkExistingAccount, linkExistingAccount, 'linkExistingAccount')
  yield* Saga.chainAction2(WalletsGen.validateAccountName, validateAccountName, 'validateAccountName')
  yield* Saga.chainAction2(WalletsGen.validateSecretKey, validateSecretKey, 'validateSecretKey')
  yield* Saga.chainAction2(WalletsGen.exportSecretKey, exportSecretKey, 'exportSecretKey')
  yield* Saga.chainAction2(
    [WalletsGen.loadDisplayCurrencies, WalletsGen.openSendRequestForm],
    loadDisplayCurrencies,
    'loadDisplayCurrencies'
  )
  yield* Saga.chainAction2(WalletsGen.loadSendAssetChoices, loadSendAssetChoices, 'loadSendAssetChoices')
  yield* Saga.chainAction2(WalletsGen.loadDisplayCurrency, loadDisplayCurrency, 'loadDisplayCurrency')
  yield* Saga.chainAction2(
    WalletsGen.loadInflationDestination,
    loadInflationDestination,
    'loadInflationDestination'
  )
  yield* Saga.chainAction2(WalletsGen.loadExternalPartners, loadExternalPartners, 'loadExternalPartners')
  yield* Saga.chainAction2(
    WalletsGen.setInflationDestination,
    setInflationDestination,
    'setInflationDestination'
  )
  yield* Saga.chainAction2(WalletsGen.displayCurrencyReceived, refreshAssets, 'refreshAssets')
  yield* Saga.chainAction2(WalletsGen.changeDisplayCurrency, changeDisplayCurrency, 'changeDisplayCurrency')
  yield* Saga.chainAction2(WalletsGen.setAccountAsDefault, setAccountAsDefault, 'setAccountAsDefault')
  yield* Saga.chainAction2(WalletsGen.changeAccountName, changeAccountName, 'changeAccountName')
  yield* Saga.chainAction2(WalletsGen.selectAccount, navigateToAccount, 'navigateToAccount')
  yield* Saga.chainAction2(WalletsGen.showTransaction, navigateToTransaction, 'navigateToTransaction')
  yield* Saga.chainAction2(
    [WalletsGen.didSetAccountAsDefault, WalletsGen.changedAccountName],
    navigateUp,
    'navigateUp'
  )
  yield* Saga.chainAction2(
    [WalletsGen.createdNewAccount, WalletsGen.linkedExistingAccount],
    createdOrLinkedAccount,
    'createdOrLinkedAccount'
  )
  yield* Saga.chainAction2(
    WalletsGen.accountsReceived,
    maybeSelectDefaultAccount,
    'maybeSelectDefaultAccount'
  )

  // We don't call this for publicMemo/secretNote so the button doesn't
  // spinner as you type
  yield* Saga.chainAction2(WalletsGen.buildPayment, buildPayment, 'buildPayment')
  yield* Saga.chainAction2(
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
  yield* Saga.chainAction2(WalletsGen.openSendRequestForm, openSendRequestForm, 'openSendRequestForm')
  yield* Saga.chainAction2(WalletsGen.reviewPayment, reviewPayment, 'reviewPayment')
  yield* Saga.chainAction2(WalletsGen.openSendRequestForm, startPayment, 'startPayment')
  yield* Saga.chainAction2(
    WalletsGen.accountsReceived,
    maybePopulateBuildingCurrency,
    'maybePopulateBuildingCurrency'
  )

  yield* Saga.chainAction2(WalletsGen.deletedAccount, deletedAccount, 'deletedAccount')

  yield* Saga.chainAction2(WalletsGen.sendPayment, sendPayment, 'sendPayment')
  yield* Saga.chainAction2(
    [WalletsGen.sentPayment, WalletsGen.requestedPayment],
    setLastSentXLM,
    'setLastSentXLM'
  )
  yield* Saga.chainAction2(
    [WalletsGen.sentPayment, WalletsGen.requestedPayment],
    clearBuilding,
    'clearBuilding'
  )
  yield* Saga.chainAction2(WalletsGen.sentPayment, clearBuiltPayment)
  yield* Saga.chainAction2([WalletsGen.sentPayment, WalletsGen.abandonPayment], clearErrors, 'clearErrors')

  yield* Saga.chainAction2(
    [WalletsGen.abandonPayment],
    maybeNavigateAwayFromSendForm,
    'maybeNavigateAwayFromSendForm'
  )

  yield* Saga.chainAction2(
    [WalletsGen.sentPayment],
    maybeNavigateToConversationFromPayment,
    'maybeNavigateToConversationFromPayment'
  )

  yield* Saga.chainGenerator<WalletsGen.RequestPaymentPayload>(
    WalletsGen.requestPayment,
    requestPayment,
    'requestPayment'
  )
  yield* Saga.chainAction2(
    [WalletsGen.requestedPayment, WalletsGen.abandonPayment],
    clearBuiltRequest,
    'clearBuiltRequest'
  )
  yield* Saga.chainAction2(
    WalletsGen.requestedPayment,
    maybeNavigateToConversationFromRequest,
    'maybeNavigateToConversationFromRequest'
  )

  // Effects of abandoning payments
  yield* Saga.chainAction2(WalletsGen.abandonPayment, stopPayment, 'stopPayment')

  yield* Saga.chainAction2(WalletsGen.exitFailedPayment, exitFailedPayment, 'exitFailedPayment')
  yield* Saga.chainAction2(WalletsGen.cancelRequest, cancelRequest, 'cancelRequest')
  yield* Saga.chainAction2(WalletsGen.cancelPayment, cancelPayment, 'cancelPayment')

  // Clear some errors on navigateUp, clear new txs on switchTab
  yield* Saga.chainAction2(RouteTreeGen.navigateUp, maybeClearErrors, 'maybeClearErrors')

  yield* Saga.chainAction2(NotificationsGen.receivedBadgeState, receivedBadgeState, 'receivedBadgeState')

  yield* Saga.chainAction2(
    [WalletsGen.loadAccounts, ConfigGen.bootstrapStatusLoaded, WalletsGen.loadWalletDisclaimer],
    loadWalletDisclaimer,
    'loadWalletDisclaimer'
  )
  yield* Saga.chainAction2(WalletsGen.acceptDisclaimer, acceptDisclaimer, 'acceptDisclaimer')
  yield* Saga.chainAction2(WalletsGen.checkDisclaimer, checkDisclaimer, 'checkDisclaimer')
  yield* Saga.chainAction2(WalletsGen.rejectDisclaimer, rejectDisclaimer, 'rejectDisclaimer')

  yield* Saga.chainAction2(
    [WalletsGen.loadMobileOnlyMode, WalletsGen.selectAccount],
    loadMobileOnlyMode,
    'loadMobileOnlyMode'
  )
  yield* Saga.chainAction2(WalletsGen.changeMobileOnlyMode, changeMobileOnlyMode, 'changeMobileOnlyMode')
  yield* Saga.chainAction2(WalletsGen.setLastSentXLM, writeLastSentXLM, 'writeLastSentXLM')
  yield* Saga.chainAction2(ConfigGen.daemonHandshakeDone, readLastSentXLM, 'readLastSentXLM')
  yield* Saga.chainAction2(
    EngineGen.stellar1NotifyAccountDetailsUpdate,
    accountDetailsUpdate,
    'accountDetailsUpdate'
  )
  yield* Saga.chainAction2(EngineGen.stellar1NotifyAccountsUpdate, accountsUpdate, 'accountsUpdate')
  yield* Saga.chainAction2(
    EngineGen.stellar1NotifyPendingPaymentsUpdate,
    pendingPaymentsUpdate,
    'pendingPaymentsUpdate'
  )
  yield* Saga.chainAction2(
    EngineGen.stellar1NotifyRecentPaymentsUpdate,
    recentPaymentsUpdate,
    'recentPaymentsUpdate'
  )
  yield* Saga.chainAction2(EngineGen.stellar1UiPaymentReviewed, paymentReviewed, 'paymentReviewed')
  yield* Saga.chainAction2(WalletsGen.validateSEP7Link, validateSEP7Link, 'validateSEP7Link')

  yield* Saga.chainAction2(WalletsGen.acceptSEP7Pay, acceptSEP7Pay, 'acceptSEP7Pay')
  yield* Saga.chainAction2(WalletsGen.acceptSEP7Path, acceptSEP7Path, 'acceptSEP7Path')
  yield* Saga.chainAction2(WalletsGen.acceptSEP7Tx, acceptSEP7Tx, 'acceptSEP7Tx')

  if (flags.airdrop) {
    yield* Saga.chainAction2(GregorGen.pushState, gregorPushState, 'gregorPushState')
    yield* Saga.chainAction2(WalletsGen.changeAirdrop, changeAirdrop, 'changeAirdrop')
    yield* Saga.chainAction2(
      [WalletsGen.updateAirdropDetails, ConfigGen.daemonHandshakeDone, ConfigGen.loggedIn],
      updateAirdropDetails,
      'updateAirdropDetails'
    )
    yield* Saga.chainAction2(
      [WalletsGen.updateAirdropState, ConfigGen.daemonHandshakeDone, ConfigGen.loggedIn],
      updateAirdropState,
      'updateAirdropState'
    )
    yield* Saga.chainAction2(
      [WalletsGen.hideAirdropBanner, WalletsGen.changeAirdrop],
      hideAirdropBanner,
      'hideAirdropBanner'
    )
  }

  yield* Saga.chainAction2(
    WalletsGen.refreshTrustlineAcceptedAssets,
    refreshTrustlineAcceptedAssets,
    'refreshTrustlineAcceptedAssets'
  )
  yield* Saga.chainAction2(
    WalletsGen.refreshTrustlineAcceptedAssetsByUsername,
    refreshTrustlineAcceptedAssetsByUsername,
    'refreshTrustlineAcceptedAssetsByUsername'
  )
  yield* Saga.chainAction2(
    WalletsGen.refreshTrustlinePopularAssets,
    refreshTrustlinePopularAssets,
    'refreshTrustlinePopularAssets'
  )
  yield* Saga.chainAction2(WalletsGen.addTrustline, addTrustline, 'addTrustline')
  yield* Saga.chainAction2(WalletsGen.deleteTrustline, deleteTrustline, 'deleteTrustline')
  yield* Saga.chainAction2(WalletsGen.setTrustlineSearchText, searchTrustlineAssets, 'searchTrustlineAssets')
  yield* Saga.chainAction2(
    WalletsGen.calculateBuildingAdvanced,
    calculateBuildingAdvanced,
    'calculateBuildingAdvanced'
  )
  yield* Saga.chainAction2(WalletsGen.sendPaymentAdvanced, sendPaymentAdvanced, 'sendPaymentAdvanced')
  yield* Saga.chainGenerator<ConfigGen.DaemonHandshakePayload>(
    ConfigGen.daemonHandshake,
    loadStaticConfig,
    'loadStaticConfig'
  )
  yield* Saga.chainAction2(WalletsGen.assetDeposit, assetDeposit, 'assetDeposit')
  yield* Saga.chainAction2(WalletsGen.assetWithdraw, assetWithdraw, 'assetWithdraw')
}

export default walletsSaga
