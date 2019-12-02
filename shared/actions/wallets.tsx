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
import _logger from '../logger'
import * as Tabs from '../constants/tabs'
import * as SettingsConstants from '../constants/settings'
import * as TeamBuildingGen from './team-building-gen'
import commonTeamBuildingSaga, {filterForNs} from './team-building'
import flags from '../util/feature-flags'
import {RPCError} from '../util/errors'
import openURL from '../util/open-url'
import {isMobile} from '../constants/platform'
import {TypedActions, TypedState} from '../util/container'
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
    _logger.error(`buildPayment error: ${err.message}`)
    throw err
  }
}

const buildPayment = async (state: TypedState, _: WalletsGen.BuildPaymentPayload) => {
  try {
    if (state.wallets.building.isRequest) {
      const build = await RPCStellarTypes.localBuildRequestLocalRpcPromise(
        stateToBuildRequestParams(state),
        Constants.buildPaymentWaitingKey
      )
      return WalletsGen.createBuiltRequestReceived({
        build: Constants.buildRequestResultToBuiltRequest(build),
        forBuildCounter: state.wallets.buildCounter,
      })
    } else {
      const build = await RPCStellarTypes.localBuildPaymentLocalRpcPromise(
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
      )
      return WalletsGen.createBuiltPaymentReceived({
        build: Constants.buildPaymentResultToBuiltPayment(build),
        forBuildCounter: state.wallets.buildCounter,
      })
    }
  } catch (err) {
    return buildErrCatcher(err)
  }
}

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
    return false
  }
  if (action.type === WalletsGen.displayCurrencyReceived && !action.payload.setBuildingCurrency) {
    // didn't change state.building; no need to call build
    return false
  }
  return WalletsGen.createBuildPayment()
}

const openSendRequestForm = (state: TypedState, _: WalletsGen.OpenSendRequestFormPayload) => {
  if (!state.wallets.acceptedDisclaimer) {
    // redirect to disclaimer
    return RouteTreeGen.createNavigateAppend({path: ['walletOnboarding']})
  }

  // load accounts for default display currency
  const accountsLoaded = Constants.getAccounts(state).length > 0
  return [
    !accountsLoaded && WalletsGen.createLoadAccounts({reason: 'open-send-req-form'}),
    RouteTreeGen.createNavigateAppend({path: [Constants.sendRequestFormRouteKey]}),
  ]
}

const maybePopulateBuildingCurrency = (state: TypedState, _: WalletsGen.AccountsReceivedPayload) =>
  (state.wallets.building.bid || state.wallets.building.isRequest) && !state.wallets.building.currency // building a payment and haven't set currency yet
    ? WalletsGen.createSetBuildingCurrency({
        currency: Constants.getDefaultDisplayCurrency(state.wallets).code,
      })
    : null

const createNewAccount = async (
  _: TypedState,
  action: WalletsGen.CreateNewAccountPayload,
  logger: Saga.SagaLogger
) => {
  const {name} = action.payload
  try {
    const accountIDString = await RPCStellarTypes.localCreateWalletAccountLocalRpcPromise(
      {name},
      Constants.createNewAccountWaitingKey
    )
    const accountID = Types.stringToAccountID(accountIDString)
    return WalletsGen.createCreatedNewAccount({
      accountID,
      setBuildingTo: action.payload.setBuildingTo,
      showOnCreation: action.payload.showOnCreation,
    })
  } catch (err) {
    logger.warn(`Error: ${err.desc}`)
    return WalletsGen.createCreatedNewAccount({accountID: Types.noAccountID, error: err.desc, name})
  }
}

const emptyAsset: RPCStellarTypes.Asset = {
  authEndpoint: '',
  code: '',
  depositButtonText: '',
  depositReqAuth: false,
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
  withdrawReqAuth: false,
  withdrawType: '',
}

const emptyAssetWithoutType: RPCStellarTypes.Asset = {
  ...emptyAsset,
  type: '',
}

const sendPayment = async (state: TypedState) => {
  const notXLM = state.wallets.building.currency !== '' && state.wallets.building.currency !== 'XLM'
  try {
    const res = await RPCStellarTypes.localSendPaymentLocalRpcPromise(
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
    return WalletsGen.createSentPayment({
      jumpToChat: res.jumpToChat,
      kbTxID: new HiddenString(res.kbTxID),
      lastSentXLM: !notXLM,
    })
  } catch (err) {
    return WalletsGen.createSentPaymentError({error: err.desc})
  }
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
    return false
  }
  if (!buildRes.readyToRequest) {
    logger.warn(
      `invalid form submitted. amountErr: ${buildRes.amountErrMsg}; secretNoteErr: ${buildRes.secretNoteErrMsg}; toErrMsg: ${buildRes.toErrMsg}`
    )
    yield Saga.put(
      WalletsGen.createBuiltRequestReceived({
        build: Constants.buildRequestResultToBuiltRequest(buildRes),
        forBuildCounter: state.wallets.buildCounter,
      })
    )
    return false
  }

  const kbRqID: Saga.RPCPromiseType<typeof RPCStellarTypes.localMakeRequestLocalRpcPromise> = yield RPCStellarTypes.localMakeRequestLocalRpcPromise(
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
  return false
}

const startPayment = async (state: TypedState) => {
  if (!state.wallets.acceptedDisclaimer || state.wallets.building.isRequest) {
    return null
  }
  const bid = await RPCStellarTypes.localStartBuildPaymentLocalRpcPromise()
  return WalletsGen.createBuildingPaymentIDReceived({bid})
}

const reviewPayment = async (state: TypedState) => {
  try {
    await RPCStellarTypes.localReviewPaymentLocalRpcPromise({
      bid: state.wallets.building.bid,
      reviewID: state.wallets.reviewCounter,
    })
    return
  } catch (error) {
    if (error instanceof RPCError && error.code === RPCTypes.StatusCode.sccanceled) {
      // ignore cancellation, which is expected in the case where we have a
      // failing review and then we build or stop a payment
      return undefined
    } else {
      return WalletsGen.createSentPaymentError({error: error.desc})
    }
  }
}

const stopPayment = (state: TypedState, _: WalletsGen.AbandonPaymentPayload) =>
  RPCStellarTypes.localStopBuildPaymentLocalRpcPromise({bid: state.wallets.building.bid})

const validateSEP7Link = async (_: TypedState, action: WalletsGen.ValidateSEP7LinkPayload) => {
  try {
    const tx = await RPCStellarTypes.localValidateStellarURILocalRpcPromise({inputURI: action.payload.link})
    return [
      WalletsGen.createSetSEP7Tx({confirmURI: action.payload.link, tx: Constants.makeSEP7ConfirmInfo(tx)}),
      WalletsGen.createValidateSEP7LinkError({error: ''}),
      RouteTreeGen.createClearModals(),
      RouteTreeGen.createNavigateAppend({path: ['sep7Confirm']}),
    ]
  } catch (error) {
    return [
      WalletsGen.createValidateSEP7LinkError({
        error: error.desc,
      }),
      RouteTreeGen.createClearModals(),
      RouteTreeGen.createNavigateAppend({
        path: [{props: {errorSource: 'sep7'}, selected: 'keybaseLinkError'}],
      }),
    ]
  }
}

const acceptSEP7Tx = async (_: TypedState, action: WalletsGen.AcceptSEP7TxPayload) => {
  try {
    await RPCStellarTypes.localApproveTxURILocalRpcPromise(
      {inputURI: action.payload.inputURI},
      Constants.sep7WaitingKey
    )
  } catch (error) {
    return WalletsGen.createSetSEP7SendError({error: error.desc})
  }

  return [RouteTreeGen.createClearModals(), RouteTreeGen.createSwitchTab({tab: Tabs.walletsTab})]
}

const acceptSEP7Path = async (state: TypedState, action: WalletsGen.AcceptSEP7PathPayload) => {
  try {
    await RPCStellarTypes.localApprovePathURILocalRpcPromise(
      {
        fromCLI: false,
        fullPath: paymentPathToRpcPaymentPath(state.wallets.sep7ConfirmPath.fullPath),
        inputURI: action.payload.inputURI,
      },
      Constants.sep7WaitingKey
    )
  } catch (error) {
    return WalletsGen.createSetSEP7SendError({error: error.desc})
  }

  return [RouteTreeGen.createClearModals(), RouteTreeGen.createSwitchTab({tab: Tabs.walletsTab})]
}

const acceptSEP7Pay = async (_: TypedState, action: WalletsGen.AcceptSEP7PayPayload) => {
  try {
    await RPCStellarTypes.localApprovePayURILocalRpcPromise(
      {
        amount: action.payload.amount,
        fromCLI: false,
        inputURI: action.payload.inputURI,
      },
      Constants.sep7WaitingKey
    )
  } catch (error) {
    return WalletsGen.createSetSEP7SendError({error: error.desc})
  }
  return [RouteTreeGen.createClearModals(), RouteTreeGen.createSwitchTab({tab: Tabs.walletsTab})]
}

const clearBuiltPayment = () => WalletsGen.createClearBuiltPayment()
const clearBuiltRequest = () => WalletsGen.createClearBuiltRequest()

const clearBuilding = () => WalletsGen.createClearBuilding()

const clearErrors = () => WalletsGen.createClearErrors()

const loadWalletDisclaimer = async (
  state: TypedState,
  action:
    | ConfigGen.LoggedInPayload
    | ConfigGen.StartupFirstIdlePayload
    | WalletsGen.LoadAccountsPayload
    | WalletsGen.LoadWalletDisclaimerPayload
) => {
  // We want to load disclaimer status for the new user when you switch users,
  // so we listen to loggedIn. But we don't want to slow down app startup: in
  // that case, do nothing on initial login and wait for startupFirstIdle.
  if (action.type === ConfigGen.loggedIn && action.payload.causedByStartup) {
    return false
  }

  if (!state.config.username) {
    return false
  }
  try {
    const accepted = await RPCStellarTypes.localHasAcceptedDisclaimerLocalRpcPromise(
      undefined,
      Constants.checkOnlineWaitingKey
    )
    return WalletsGen.createWalletDisclaimerReceived({accepted})
  } catch (_) {
    return false // handled by reloadable
  }
}

const loadAccounts = async (
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
    return false
  }
  if (
    (action.type === WalletsGen.linkedExistingAccount || action.type === WalletsGen.createdNewAccount) &&
    (action.payload.error || !action.payload.accountID)
  ) {
    return false
  }
  try {
    const res = await RPCStellarTypes.localGetWalletAccountsLocalRpcPromise(undefined, [
      Constants.checkOnlineWaitingKey,
      Constants.loadAccountsWaitingKey,
    ])
    return WalletsGen.createAccountsReceived({
      accounts: (res || []).map(account => {
        if (!account.accountID) {
          logger.error(`Found empty accountID, name: ${account.name} isDefault: ${String(account.isDefault)}`)
        }
        return Constants.accountResultToAccount(account)
      }),
    })
  } catch (err) {
    const msg = `Error: ${err.desc}`
    if (action.type === WalletsGen.loadAccounts && action.payload.reason === 'initial-load') {
      // No need to throw black bars -- handled by Reloadable.
      logger.warn(msg)
      return false
    } else {
      logger.error(msg)
      throw err
    }
  }
}

const handleSelectAccountError = (action, msg, err) => {
  const errMsg = `Error ${msg}: ${err.desc}`
  // Assume that for auto-selected we're on the Wallets tab.
  if (
    (action.type === WalletsGen.selectAccount && action.payload.reason === 'user-selected') ||
    action.payload.reason === 'auto-selected'
  ) {
    // No need to throw black bars -- handled by Reloadable.
    _logger.warn(errMsg)
  } else {
    _logger.error(errMsg)
    throw err
  }
}

type LoadAssetsActions =
  | WalletsGen.LoadAssetsPayload
  | WalletsGen.SelectAccountPayload
  | WalletsGen.LinkedExistingAccountPayload
  | WalletsGen.AccountUpdateReceivedPayload
  | WalletsGen.AccountsReceivedPayload
const loadAssets = async (state: TypedState, action: LoadAssetsActions, logger: Saga.SagaLogger) => {
  if (action.type === WalletsGen.linkedExistingAccount && action.payload.error) {
    return false
  }
  if (!state.config.loggedIn) {
    logger.error('not logged in')
    return false
  }
  let accountID: Types.AccountID | undefined
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

  // should be impossible
  if (!accountID) {
    return
  }

  // check that we've loaded the account, don't load assets if we don't have the account
  try {
    accountID = Constants.getAccount(state, accountID).accountID
    if (!Types.isValidAccountID(accountID)) {
      return false
    }
    const res = await RPCStellarTypes.localGetAccountAssetsLocalRpcPromise(
      {accountID},
      Constants.checkOnlineWaitingKey
    )
    return WalletsGen.createAssetsReceived({
      accountID,
      assets: (res || []).map(assets => Constants.assetsResultToAssets(assets)),
    })
  } catch (err) {
    return handleSelectAccountError(action, 'selecting account', err)
  }
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
const loadPayments = async (state: TypedState, action: LoadPaymentsActions, logger: Saga.SagaLogger) => {
  const {accountID} = action.payload

  if (!state.config.loggedIn) {
    logger.error('not logged in')
    return false
  }
  if ((action.type === WalletsGen.linkedExistingAccount && action.payload.error) || !accountID) {
    return false
  }
  if (
    !!(action.type === WalletsGen.selectAccount && Types.isValidAccountID(accountID)) ||
    Types.isValidAccountID(Constants.getAccount(state, accountID).accountID)
  ) {
    const [pending, payments] = await Promise.all([
      RPCStellarTypes.localGetPendingPaymentsLocalRpcPromise({accountID}),
      RPCStellarTypes.localGetPaymentsLocalRpcPromise({accountID}),
    ])
    return createPaymentsReceived(accountID, payments, pending, true)
  }
  return false
}

const loadMorePayments = async (
  state: TypedState,
  action: WalletsGen.LoadMorePaymentsPayload,
  logger: Saga.SagaLogger
) => {
  if (!state.config.loggedIn) {
    logger.error('not logged in')
    return false
  }
  const cursor = state.wallets.paymentCursorMap.get(action.payload.accountID)
  if (!cursor) {
    return false
  }
  const payments = await RPCStellarTypes.localGetPaymentsLocalRpcPromise({
    accountID: action.payload.accountID,
    cursor,
  })
  return createPaymentsReceived(action.payload.accountID, payments, [], false)
}

// We only need to load these once per session
const loadDisplayCurrencies = async (state: TypedState) => {
  if (Constants.displayCurrenciesLoaded(state)) {
    return false
  }
  const res = await RPCStellarTypes.localGetDisplayCurrenciesLocalRpcPromise()
  return WalletsGen.createDisplayCurrenciesReceived({
    currencies: (res || []).map(c => Constants.currencyResultToCurrency(c)),
  })
}

const loadSendAssetChoices = async (_: TypedState, action: WalletsGen.LoadSendAssetChoicesPayload) => {
  try {
    const res = await RPCStellarTypes.localGetSendAssetChoicesLocalRpcPromise({
      from: action.payload.from,
      to: action.payload.to,
    })
    // The result is dropped here. See PICNIC-84 for fixing it.
    return res && WalletsGen.createSendAssetChoicesReceived({sendAssetChoices: res})
  } catch (err) {
    _logger.warn(`Error: ${err.desc}`)
    return false
  }
}

const loadDisplayCurrency = async (_: TypedState, action: WalletsGen.LoadDisplayCurrencyPayload) => {
  let accountID = action.payload.accountID
  if (accountID && !Types.isValidAccountID(accountID)) {
    accountID = null
  }
  const res = await RPCStellarTypes.localGetDisplayCurrencyLocalRpcPromise(
    {accountID: accountID},
    Constants.getDisplayCurrencyWaitingKey(accountID || Types.noAccountID)
  )
  return WalletsGen.createDisplayCurrencyReceived({
    accountID: accountID,
    currency: Constants.makeCurrency(res),
    setBuildingCurrency: action.payload.setBuildingCurrency,
  })
}

const loadExternalPartners = async () => {
  const partners = await RPCStellarTypes.localGetPartnerUrlsLocalRpcPromise()
  return WalletsGen.createExternalPartnersReceived({externalPartners: partners ?? []})
}

const refreshAssets = (_: TypedState, action: WalletsGen.DisplayCurrencyReceivedPayload) =>
  action.payload.accountID ? WalletsGen.createLoadAssets({accountID: action.payload.accountID}) : undefined

const changeDisplayCurrency = async (_: TypedState, action: WalletsGen.ChangeDisplayCurrencyPayload) => {
  const currencyRes = await RPCStellarTypes.localChangeDisplayCurrencyLocalRpcPromise(
    {
      accountID: action.payload.accountID,
      currency: action.payload.code, // called currency, though it is a code
    },
    Constants.changeDisplayCurrencyWaitingKey
  )
  return WalletsGen.createDisplayCurrencyReceived({
    accountID: action.payload.accountID,
    currency: Constants.makeCurrency(currencyRes),
    setBuildingCurrency: false,
  })
}

const changeAccountName = async (_: TypedState, action: WalletsGen.ChangeAccountNamePayload) => {
  const res = await RPCStellarTypes.localChangeWalletAccountNameLocalRpcPromise(
    {
      accountID: action.payload.accountID,
      newName: action.payload.name,
    },
    Constants.changeAccountNameWaitingKey
  )
  return WalletsGen.createChangedAccountName({account: Constants.accountResultToAccount(res)})
}

const deleteAccount = async (_: TypedState, action: WalletsGen.DeleteAccountPayload) => {
  await RPCStellarTypes.localDeleteWalletAccountLocalRpcPromise(
    {
      accountID: action.payload.accountID,
      userAcknowledged: 'yes',
    },
    Constants.deleteAccountWaitingKey
  )
  return WalletsGen.createDeletedAccount()
}

const setAccountAsDefault = async (_: TypedState, action: WalletsGen.SetAccountAsDefaultPayload) => {
  const accountsAfterUpdate = await RPCStellarTypes.localSetWalletAccountAsDefaultLocalRpcPromise(
    {accountID: action.payload.accountID},
    Constants.setAccountAsDefaultWaitingKey
  )
  return WalletsGen.createDidSetAccountAsDefault({
    accounts: (accountsAfterUpdate || []).map(account => {
      if (!account.accountID) {
        _logger.error(`Found empty accountID, name: ${account.name} isDefault: ${String(account.isDefault)}`)
      }
      return Constants.accountResultToAccount(account)
    }),
  })
}

const loadPaymentDetail = async (
  _: TypedState,
  action: WalletsGen.LoadPaymentDetailPayload,
  logger: Saga.SagaLogger
) => {
  try {
    const res = await RPCStellarTypes.localGetPaymentDetailsLocalRpcPromise(
      {
        accountID: action.payload.accountID,
        id: Types.paymentIDToRPCPaymentID(action.payload.paymentID),
      },
      [Constants.checkOnlineWaitingKey, Constants.getRequestDetailsWaitingKey(action.payload.paymentID)]
    )
    return WalletsGen.createPaymentDetailReceived({
      accountID: action.payload.accountID,
      payment: Constants.rpcPaymentDetailToPaymentDetail(res),
    })
  } catch (err) {
    // No need to throw black bars -- handled by Reloadable.
    logger.warn(err.desc)
    return false
  }
}

const markAsRead = async (_: TypedState, action: WalletsGen.MarkAsReadPayload, logger: Saga.SagaLogger) => {
  try {
    return RPCStellarTypes.localMarkAsReadLocalRpcPromise({
      accountID: action.payload.accountID,
      mostRecentID: Types.paymentIDToRPCPaymentID(action.payload.mostRecentID),
    })
  } catch (err) {
    // No need to throw black bars.
    logger.warn(err.desc)
    return false
  }
}

const linkExistingAccount = async (
  _: TypedState,
  action: WalletsGen.LinkExistingAccountPayload,
  logger: Saga.SagaLogger
) => {
  const {name, secretKey} = action.payload
  try {
    const accountIDString = await RPCStellarTypes.localLinkNewWalletAccountLocalRpcPromise(
      {
        name,
        secretKey: secretKey.stringValue(),
      },
      Constants.linkExistingWaitingKey
    )
    const accountID = Types.stringToAccountID(accountIDString)
    return WalletsGen.createLinkedExistingAccount({
      accountID,
      setBuildingTo: action.payload.setBuildingTo,
      showOnCreation: action.payload.showOnCreation,
    })
  } catch (err) {
    logger.warn(`Error: ${err.desc}`)
    return WalletsGen.createLinkedExistingAccount({
      accountID: Types.noAccountID,
      error: err.desc,
      name,
      secretKey,
    })
  }
}

const validateAccountName = async (
  _: TypedState,
  action: WalletsGen.ValidateAccountNamePayload,
  logger: Saga.SagaLogger
) => {
  const {name} = action.payload
  try {
    await RPCStellarTypes.localValidateAccountNameLocalRpcPromise(
      {name},
      Constants.validateAccountNameWaitingKey
    )
    return WalletsGen.createValidatedAccountName({name})
  } catch (err) {
    logger.warn(`Error: ${err.desc}`)
    return WalletsGen.createValidatedAccountName({error: err.desc, name})
  }
}

const validateSecretKey = async (
  _: TypedState,
  action: WalletsGen.ValidateSecretKeyPayload,
  logger: Saga.SagaLogger
) => {
  const {secretKey} = action.payload
  try {
    await RPCStellarTypes.localValidateSecretKeyLocalRpcPromise(
      {secretKey: secretKey.stringValue()},
      Constants.validateSecretKeyWaitingKey
    )
    return WalletsGen.createValidatedSecretKey({secretKey})
  } catch (err) {
    logger.warn(`Error: ${err.desc}`)
    return WalletsGen.createValidatedSecretKey({error: err.desc, secretKey})
  }
}

const deletedAccount = (state: TypedState) => {
  const a = Constants.getDefaultAccount(state.wallets)
  return (
    a !== Constants.unknownAccount &&
    WalletsGen.createSelectAccount({
      accountID: a.accountID,
      reason: 'auto-selected',
      show: true,
    })
  )
}

const createdOrLinkedAccount = (
  _: TypedState,
  action: WalletsGen.CreatedNewAccountPayload | WalletsGen.LinkedExistingAccountPayload
) => {
  if (action.payload.error || !action.payload.accountID) {
    // Create new account failed, don't nav
    return false
  }
  if (action.payload.showOnCreation) {
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
  if (action.type === WalletsGen.changedAccountName && action.payload.error) {
    // we don't want to nav on error
    return false
  }
  return RouteTreeGen.createNavigateUp()
}

const navigateToAccount = (_: TypedState, action: WalletsGen.SelectAccountPayload) => {
  if (action.type === WalletsGen.selectAccount && !action.payload.show) {
    // we don't want to show, don't nav
    return false
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

const exportSecretKey = async (_: TypedState, action: WalletsGen.ExportSecretKeyPayload) => {
  const res = await RPCStellarTypes.localGetWalletAccountSecretKeyLocalRpcPromise({
    accountID: action.payload.accountID,
  })
  return WalletsGen.createSecretKeyReceived({
    accountID: action.payload.accountID,
    secretKey: new HiddenString(res),
  })
}

const maybeSelectDefaultAccount = (
  state: TypedState,
  _: WalletsGen.AccountsReceivedPayload,
  logger: Saga.SagaLogger
) => {
  if (!state.config.loggedIn) {
    logger.error('not logged in')
    return false
  }
  if (state.wallets.selectedAccount === Types.noAccountID) {
    const maybeDefaultAccount = Constants.getDefaultAccount(state.wallets)
    if (maybeDefaultAccount !== Constants.unknownAccount) {
      return WalletsGen.createSelectAccount({
        accountID: maybeDefaultAccount.accountID,
        reason: 'auto-selected',
      })
    }
  }
  return false
}

const cancelPayment = async (
  state: TypedState,
  action: WalletsGen.CancelPaymentPayload,
  logger: Saga.SagaLogger
) => {
  const {paymentID, showAccount} = action.payload
  const pid = Types.paymentIDToString(paymentID)
  logger.info(`cancelling payment with ID ${pid}`)
  try {
    await RPCStellarTypes.localCancelPaymentLocalRpcPromise(
      {paymentID: Types.paymentIDToRPCPaymentID(paymentID)},
      Constants.cancelPaymentWaitingKey(paymentID)
    )
    logger.info(`successfully cancelled payment with ID ${pid}`)
    if (showAccount) {
      return WalletsGen.createSelectAccount({
        accountID: Constants.getSelectedAccount(state),
        reason: 'auto-selected',
        show: true,
      })
    }
    return false
  } catch (err) {
    logger.error(`failed to cancel payment with ID ${pid}. Error: ${err.message}`)
    throw err
  }
}

const cancelRequest = async (
  _: TypedState,
  action: WalletsGen.CancelRequestPayload,
  logger: Saga.SagaLogger
) => {
  try {
    return RPCStellarTypes.localCancelRequestLocalRpcPromise({reqID: action.payload.requestID})
  } catch (err) {
    logger.error(`Error: ${err.message}`)
    return false
  }
}

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
    return false
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

const checkDisclaimer = async (
  _: TypedState,
  action: WalletsGen.CheckDisclaimerPayload,
  logger: Saga.SagaLogger
) => {
  try {
    const accepted = await RPCStellarTypes.localHasAcceptedDisclaimerLocalRpcPromise()
    const actions: Array<Action> = [WalletsGen.createWalletDisclaimerReceived({accepted})]
    if (!accepted) {
      return actions
    }

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
    return actions
  } catch (err) {
    logger.error(`Error checking wallet disclaimer: ${err.message}`)
    return false
  }
}

const rejectDisclaimer = (_: TypedState, __: WalletsGen.RejectDisclaimerPayload) =>
  isMobile ? RouteTreeGen.createNavigateUp() : RouteTreeGen.createSwitchTab({tab: Tabs.peopleTab})

const loadMobileOnlyMode = async (
  _: TypedState,
  action: WalletsGen.LoadMobileOnlyModePayload | WalletsGen.SelectAccountPayload,
  logger: Saga.SagaLogger
) => {
  let accountID = action.payload.accountID
  if (!Types.isValidAccountID(accountID)) {
    logger.warn('invalid account ID, bailing')
    return false
  }
  try {
    const isMobileOnly = await RPCStellarTypes.localIsAccountMobileOnlyLocalRpcPromise({
      accountID,
    })
    return WalletsGen.createLoadedMobileOnlyMode({
      accountID: accountID,
      enabled: isMobileOnly,
    })
  } catch (err) {
    handleSelectAccountError(action, 'loading mobile only mode', err)
    return false
  }
}

const changeMobileOnlyMode = async (_: TypedState, action: WalletsGen.ChangeMobileOnlyModePayload) => {
  let accountID = action.payload.accountID
  let f = action.payload.enabled
    ? RPCStellarTypes.localSetAccountMobileOnlyLocalRpcPromise
    : RPCStellarTypes.localSetAccountAllDevicesLocalRpcPromise
  await f({accountID}, Constants.setAccountMobileOnlyWaitingKey(accountID))
  return WalletsGen.createLoadedMobileOnlyMode({
    accountID: accountID,
    enabled: action.payload.enabled,
  })
}

const writeLastSentXLM = async (
  state: TypedState,
  action: WalletsGen.SetLastSentXLMPayload,
  logger: Saga.SagaLogger
) => {
  if (action.payload.writeFile) {
    logger.info(`Writing config stellar.lastSentXLM: ${String(state.wallets.lastSentXLM)}`)
    try {
      return RPCTypes.configGuiSetValueRpcPromise({
        path: 'stellar.lastSentXLM',
        value: {b: state.wallets.lastSentXLM, isNull: false},
      })
    } catch (err) {
      logger.error(`Error: ${err.message}`)
      return false
    }
  }
}

const readLastSentXLM = async (
  _: TypedState,
  __: ConfigGen.DaemonHandshakeDonePayload,
  logger: Saga.SagaLogger
) => {
  logger.info(`Reading config`)
  try {
    const result = await RPCTypes.configGuiGetValueRpcPromise({path: 'stellar.lastSentXLM'})
    const value = !result.isNull && !!result.b
    logger.info(`Successfully read config: ${String(value)}`)
    return WalletsGen.createSetLastSentXLM({lastSentXLM: value, writeFile: false})
  } catch (err) {
    if (!err.message.includes('no such key')) {
      logger.error(`Error reading config: ${err.message}`)
    }
    return false
  }
}

const exitFailedPayment = (state: TypedState, _: WalletsGen.ExitFailedPaymentPayload) => {
  const accountID = state.wallets.builtPayment.from
  return [
    WalletsGen.createAbandonPayment(),
    WalletsGen.createSelectAccount({accountID, reason: 'auto-selected', show: true}),
    WalletsGen.createLoadPayments({accountID}),
  ]
}

const changeAirdrop = async (_: TypedState, action: WalletsGen.ChangeAirdropPayload) => {
  try {
    await RPCStellarTypes.localAirdropRegisterLocalRpcPromise(
      {register: action.payload.accept},
      Constants.airdropWaitingKey
    )
  } catch (err) {
    switch (err.code) {
      case RPCTypes.StatusCode.scinputerror:
      case RPCTypes.StatusCode.scduplicate:
        // If you're already out of (inputerror) or in (duplicate) the airdrop,
        // ignore those errors and we'll fix it when we refresh status below.
        break
      case RPCTypes.StatusCode.scairdropregisterfailedmisc:
        return WalletsGen.createUpdatedAirdropState({
          airdropQualifications: [],
          airdropState: 'rejected',
        })
      default:
        throw err
    }
  }
  return WalletsGen.createUpdateAirdropState() // reload
}

const updateAirdropDetails = async (
  state: TypedState,
  action:
    | WalletsGen.UpdateAirdropDetailsPayload
    | ConfigGen.StartupFirstIdlePayload
    | ConfigGen.LoggedInPayload,
  logger: Saga.SagaLogger
) => {
  if (!state.config.loggedIn) {
    return false
  }

  // ignore, we handle startup first idle instead
  if (action.type === ConfigGen.loggedIn && action.payload.causedByStartup) {
    return false
  }

  try {
    const response = await RPCStellarTypes.localAirdropDetailsLocalRpcPromise(
      undefined,
      Constants.airdropWaitingKey
    )
    const details: Constants.StellarDetailsJSONType = JSON.parse(response.details)
    const disclaimer: Constants.StellarDetailsJSONType = JSON.parse(response.disclaimer)
    return WalletsGen.createUpdatedAirdropDetails({
      details: Constants.makeStellarDetailsFromJSON(details),
      disclaimer: Constants.makeStellarDetailsFromJSON(disclaimer),
      isPromoted: response.isPromoted,
    })
  } catch (e) {
    logger.info(e)
    return false
  }
}

const updateAirdropState = async (
  state: TypedState,
  action:
    | WalletsGen.UpdateAirdropStatePayload
    | ConfigGen.StartupFirstIdlePayload
    | ConfigGen.LoggedInPayload,
  logger: Saga.SagaLogger
) => {
  if (!state.config.loggedIn) {
    return false
  }
  // ignore startup since we already listen for first idle
  if (action.type === ConfigGen.loggedIn && action.payload.causedByStartup) {
    return false
  }
  try {
    const {state, rows} = await RPCStellarTypes.localAirdropStatusLocalRpcPromise(
      undefined,
      Constants.airdropWaitingKey
    )
    let airdropState
    switch (state) {
      case 'accepted':
        airdropState = 'accepted' as const
        break
      case 'qualified':
        airdropState = 'qualified' as const
        break
      case 'unqualified':
        airdropState = 'unqualified' as const
        break
      default:
        airdropState = 'loading' as const
        logger.error('Invalid airdropstate', state)
    }

    let airdropQualifications = (rows || []).map(r =>
      Constants.makeAirdropQualification({
        subTitle: r.subtitle || '',
        title: r.title || '',
        valid: r.valid || false,
      })
    )

    return WalletsGen.createUpdatedAirdropState({airdropQualifications, airdropState})
  } catch (e) {
    logger.info(e)
    if (e.name === 'STELLAR_NEED_DISCLAIMER') {
      return WalletsGen.createUpdatedAirdropState({
        airdropQualifications: [],
        airdropState: 'needDisclaimer',
      })
    }
    return false
  }
}

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
  depositReqAuth: false,
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
  withdrawReqAuth: false,
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
  const {assets, limits} = balances.reduce<{
    assets: Array<Types.AssetDescription>
    limits: Map<Types.AssetID, number>
  }>(
    (al, balance) => {
      const assetDescriptionOrNative = rpcAssetToAssetDescriptionOrNative(balance.asset)
      if (assetDescriptionOrNative !== 'native') {
        al.assets.push(assetDescriptionOrNative)
        al.limits.set(
          Types.assetDescriptionToAssetID(assetDescriptionOrNative),
          Number.parseFloat(balance.limit) || 0
        )
      }
      return al
    },
    {assets: [], limits: new Map<Types.AssetID, number>()}
  )
  return [
    ...(Types.isValidAccountID(accountID)
      ? [
          WalletsGen.createSetTrustlineAcceptedAssets({
            accountID,
            assets,
            limits,
          }),
        ]
      : []),
    ...(username
      ? [
          WalletsGen.createSetTrustlineAcceptedAssetsByUsername({
            assets,
            limits,
            username,
          }),
        ]
      : []),
  ]
}

const refreshTrustlineAcceptedAssets = async (_: TypedState, {payload: {accountID}}) => {
  if (!Types.isValidAccountID(accountID)) {
    return false
  }
  const balances = await RPCStellarTypes.localGetTrustlinesLocalRpcPromise(
    {accountID},
    Constants.refreshTrustlineAcceptedAssetsWaitingKey(accountID)
  )
  return balancesToAction(balances || [], accountID, '')
}

const refreshTrustlineAcceptedAssetsByUsername = async (_: TypedState, {payload: {username}}) => {
  if (!username) {
    return false
  }
  const {trustlines} = await RPCStellarTypes.localGetTrustlinesForRecipientLocalRpcPromise(
    {recipient: username},
    Constants.refreshTrustlineAcceptedAssetsWaitingKey(username)
  )
  return Constants.isFederatedAddress(username)
    ? balancesToAction(trustlines || [], username, '')
    : balancesToAction(trustlines || [], Types.noAccountID, username)
}

const refreshTrustlinePopularAssets = async () => {
  const {assets, totalCount} = await RPCStellarTypes.localListPopularAssetsLocalRpcPromise()
  return WalletsGen.createSetTrustlinePopularAssets({
    assets: assets
      ? (assets
          .map((asset: RPCStellarTypes.Asset) => rpcAssetToAssetDescriptionOrNative(asset))
          .filter(asset => asset !== 'native') as Array<Types.AssetDescription>)
      : [],
    totalCount,
  })
}

const addTrustline = async (state: TypedState, {payload: {accountID, assetID}}) => {
  const asset = state.wallets.trustline.assetMap.get(assetID) ?? Constants.emptyAssetDescription
  const refresh = WalletsGen.createRefreshTrustlineAcceptedAssets({accountID})
  if (asset === Constants.emptyAssetDescription) {
    return false
  }
  try {
    await RPCStellarTypes.localAddTrustlineLocalRpcPromise(
      {
        accountID: accountID,
        limit: '',
        trustline: {assetCode: asset.code, issuer: asset.issuerAccountID},
      },
      Constants.addTrustlineWaitingKey(accountID, assetID)
    )
    return [WalletsGen.createChangedTrustline(), refresh]
  } catch (err) {
    _logger.warn(`Error: ${err.desc}`)
    return [WalletsGen.createChangedTrustline({error: err.desc}), refresh]
  }
}

const deleteTrustline = async (state: TypedState, {payload: {accountID, assetID}}) => {
  const asset = state.wallets.trustline.assetMap.get(assetID) ?? Constants.emptyAssetDescription
  const refresh = WalletsGen.createRefreshTrustlineAcceptedAssets({accountID})
  if (asset === Constants.emptyAssetDescription) {
    return false
  }
  try {
    await RPCStellarTypes.localDeleteTrustlineLocalRpcPromise(
      {
        accountID: accountID,
        trustline: {assetCode: asset.code, issuer: asset.issuerAccountID},
      },
      Constants.deleteTrustlineWaitingKey(accountID, assetID)
    )
    return [WalletsGen.createChangedTrustline(), refresh]
  } catch (err) {
    _logger.warn(`Error: ${err.desc}`)
    return [WalletsGen.createChangedTrustline({error: err.desc}), refresh]
  }
}

let lastSearchText = ''
const searchTrustlineAssets = async (_: TypedState, {payload: {text}}) => {
  lastSearchText = text
  if (!text) {
    return WalletsGen.createClearTrustlineSearchResults()
  }
  const assets = await RPCStellarTypes.localFuzzyAssetSearchLocalRpcPromise(
    {searchString: text},
    Constants.searchTrustlineAssetsWaitingKey
  )
  if (text !== lastSearchText) {
    return false
  }
  return WalletsGen.createSetTrustlineSearchResults({
    assets: assets
      ? (assets
          .map(rpcAsset => rpcAssetToAssetDescriptionOrNative(rpcAsset))
          .filter(asset => asset !== 'native') as Array<Types.AssetDescription>)
      : [],
  })
}

const paymentPathToRpcPaymentPath = (paymentPath: Types.PaymentPath): RPCStellarTypes.PaymentPath => ({
  destinationAmount: paymentPath.destinationAmount,
  destinationAsset: assetDescriptionOrNativeToRpcAsset(paymentPath.destinationAsset),
  path: paymentPath.path.map(ad => assetDescriptionOrNativeToRpcAsset(ad)),
  sourceAmount: paymentPath.sourceAmount,
  sourceAmountMax: paymentPath.sourceAmountMax,
  sourceAsset: assetDescriptionOrNativeToRpcAsset(paymentPath.sourceAsset),
  sourceInsufficientBalance: paymentPath.sourceInsufficientBalance,
})

const rpcPaymentPathToPaymentPath = (rpcPaymentPath: RPCStellarTypes.PaymentPath) =>
  Constants.makePaymentPath({
    destinationAmount: rpcPaymentPath.destinationAmount,
    destinationAsset: rpcAssetToAssetDescriptionOrNative(rpcPaymentPath.destinationAsset),
    path: rpcPaymentPath.path
      ? rpcPaymentPath.path.map(rpcAsset => rpcAssetToAssetDescriptionOrNative(rpcAsset))
      : [],
    sourceAmount: rpcPaymentPath.sourceAmount,
    sourceAmountMax: rpcPaymentPath.sourceAmountMax,
    sourceAsset: rpcAssetToAssetDescriptionOrNative(rpcPaymentPath.sourceAsset),
    sourceInsufficientBalance: rpcPaymentPath.sourceInsufficientBalance,
  })

const calculateBuildingAdvanced = async (
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
      return false
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

  try {
    const res = await RPCStellarTypes.localFindPaymentPathLocalRpcPromise(
      {
        amount,
        destinationAsset,
        from,
        sourceAsset,
        to,
      },
      Constants.calculateBuildingAdvancedWaitingKey
    )
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
  } catch (err) {
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
  }
}

const sendPaymentAdvanced = async (state: TypedState) => {
  const res = await RPCStellarTypes.localSendPathLocalRpcPromise(
    {
      note: state.wallets.buildingAdvanced.secretNote.stringValue(),
      path: paymentPathToRpcPaymentPath(state.wallets.builtPaymentAdvanced.fullPath),
      publicNote: state.wallets.buildingAdvanced.publicMemo.stringValue(),
      recipient: state.wallets.buildingAdvanced.recipient,
      source: state.wallets.buildingAdvanced.senderAccountID,
    },
    Constants.sendPaymentAdvancedWaitingKey
  )
  return WalletsGen.createSentPayment({
    jumpToChat: res.jumpToChat,
    kbTxID: new HiddenString(res.kbTxID),
    lastSentXLM: false,
  })
}

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
  return false
}

const handleSEP6Error = (err: RPCError) => [
  WalletsGen.createSetSEP6Message({error: true, message: err.desc}),
  RouteTreeGen.createClearModals(),
  RouteTreeGen.createNavigateAppend({
    path: [{props: {errorSource: 'sep6'}, selected: 'keybaseLinkError'}],
  }),
]

const assetDeposit = async (_: TypedState, action: WalletsGen.AssetDepositPayload) => {
  try {
    const res = await RPCStellarTypes.localAssetDepositLocalRpcPromise(
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
    return handleSEP6Result(res)
  } catch (err) {
    return handleSEP6Error(err)
  }
}

const assetWithdraw = async (_: TypedState, action: WalletsGen.AssetWithdrawPayload) => {
  try {
    const res = await RPCStellarTypes.localAssetWithdrawLocalRpcPromise(
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
    return handleSEP6Result(res)
  } catch (err) {
    return handleSEP6Error(err)
  }
}

function* loadStaticConfig(state: TypedState, action: ConfigGen.DaemonHandshakePayload) {
  if (state.wallets.staticConfig) {
    return false
  }
  yield Saga.put(
    ConfigGen.createDaemonHandshakeWait({
      increment: true,
      name: 'wallets.loadStatic',
      version: action.payload.version,
    })
  )

  try {
    const res: Saga.RPCPromiseType<typeof RPCStellarTypes.localGetStaticConfigLocalRpcPromise> = yield RPCStellarTypes.localGetStaticConfigLocalRpcPromise()
    yield Saga.put(WalletsGen.createStaticConfigLoaded({staticConfig: res}))
  } finally {
    yield Saga.put(
      ConfigGen.createDaemonHandshakeWait({
        increment: false,
        name: 'wallets.loadStatic',
        version: action.payload.version,
      })
    )
  }
  return false
}

const onTeamBuildingAdded = (_: TypedState, action: TeamBuildingGen.AddUsersToTeamSoFarPayload) => {
  const {users} = action.payload
  const user = users[0]
  if (!user) return false

  const username = user.id
  return [
    TeamBuildingGen.createCancelTeamBuilding({namespace: 'wallets'}),
    WalletsGen.createSetBuildingTo({to: username}),
  ]
}

function* teamBuildingSaga() {
  yield* commonTeamBuildingSaga('wallets')
  yield* Saga.chainAction2(TeamBuildingGen.addUsersToTeamSoFar, filterForNs('wallets', onTeamBuildingAdded))
}

function* walletsSaga() {
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
  yield* Saga.chainAction2(WalletsGen.loadExternalPartners, loadExternalPartners, 'loadExternalPartners')
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
    [
      ConfigGen.loggedIn,
      ConfigGen.startupFirstIdle,
      WalletsGen.loadAccounts,
      WalletsGen.loadWalletDisclaimer,
    ],
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
      [WalletsGen.updateAirdropDetails, ConfigGen.startupFirstIdle, ConfigGen.loggedIn],
      updateAirdropDetails,
      'updateAirdropDetails'
    )
    yield* Saga.chainAction2(
      [WalletsGen.updateAirdropState, ConfigGen.startupFirstIdle, ConfigGen.loggedIn],
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
  yield* teamBuildingSaga()
}

export default walletsSaga
