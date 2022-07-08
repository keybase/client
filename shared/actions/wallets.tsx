import * as Chat2Gen from './chat2-gen'
import * as ConfigGen from './config-gen'
import * as Constants from '../constants/wallets'
import * as Container from '../util/container'
import * as EngineGen from './engine-gen-gen'
import * as NotificationsGen from './notifications-gen'
import * as RPCStellarTypes from '../constants/types/rpc-stellar-gen'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as RouteTreeGen from './route-tree-gen'
import * as Router2Constants from '../constants/router2'
import * as SettingsConstants from '../constants/settings'
import * as Tabs from '../constants/tabs'
import * as TeamBuildingGen from './team-building-gen'
import * as Types from '../constants/types/wallets'
import * as WalletsGen from './wallets-gen'
import HiddenString from '../util/hidden-string'
import {commonListenActions, filterForNs} from './team-building'
import logger from '../logger'
import openURL from '../util/open-url'
import {RPCError} from '../util/errors'
import {isTablet} from '../constants/platform'

const stateToBuildRequestParams = (state: Container.TypedState) => ({
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

const buildPayment = async (state: Container.TypedState) => {
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
  state: Container.TypedState,
  action:
    | WalletsGen.SetBuildingAmountPayload
    | WalletsGen.SetBuildingCurrencyPayload
    | WalletsGen.SetBuildingFromPayload
    | WalletsGen.SetBuildingIsRequestPayload
    | WalletsGen.SetBuildingToPayload
    | WalletsGen.DisplayCurrencyReceivedPayload
    | WalletsGen.BuildingPaymentIDReceivedPayload
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

const openSendRequestForm = (state: Container.TypedState) => {
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

const maybePopulateBuildingCurrency = (state: Container.TypedState) =>
  (state.wallets.building.bid || state.wallets.building.isRequest) && !state.wallets.building.currency // building a payment and haven't set currency yet
    ? WalletsGen.createSetBuildingCurrency({
        currency: Constants.getDefaultDisplayCurrency(state.wallets).code,
      })
    : null

const createNewAccount = async (_: unknown, action: WalletsGen.CreateNewAccountPayload) => {
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
  } catch (error) {
    if (!(error instanceof RPCError)) {
      return
    }
    logger.warn(`Error: ${error.desc}`)
    return WalletsGen.createCreatedNewAccount({accountID: Types.noAccountID, error: error.desc, name})
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
  useSep24: false,
  verifiedDomain: '',
  withdrawButtonText: '',
  withdrawReqAuth: false,
  withdrawType: '',
}

const emptyAssetWithoutType: RPCStellarTypes.Asset = {
  ...emptyAsset,
  type: '',
}

const sendPayment = async (state: Container.TypedState) => {
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
  } catch (error) {
    if (!(error instanceof RPCError)) {
      return
    }
    return WalletsGen.createSentPaymentError({error: error.desc})
  }
}

const setLastSentXLM = (
  _: unknown,
  action: WalletsGen.SentPaymentPayload | WalletsGen.RequestedPaymentPayload
) =>
  WalletsGen.createSetLastSentXLM({
    lastSentXLM: action.payload.lastSentXLM,
    writeFile: true,
  })

const requestPayment = async (state: Container.TypedState) => {
  let buildRes: Unpacked<ReturnType<typeof RPCStellarTypes.localBuildRequestLocalRpcPromise>>
  try {
    buildRes = await RPCStellarTypes.localBuildRequestLocalRpcPromise(
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
    return WalletsGen.createBuiltRequestReceived({
      build: Constants.buildRequestResultToBuiltRequest(buildRes),
      forBuildCounter: state.wallets.buildCounter,
    })
  }

  try {
    const kbRqID = await RPCStellarTypes.localMakeRequestLocalRpcPromise(
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
    const acts = maybeNavigateAwayFromSendForm()
    acts.push(
      WalletsGen.createRequestedPayment({
        kbRqID: new HiddenString(kbRqID),
        lastSentXLM: state.wallets.building.currency === 'XLM',
        requestee: state.wallets.building.to,
      })
    )
    return acts
  } catch (error) {
    if (error instanceof RPCError && error.code === RPCTypes.StatusCode.scteamcontactsettingsblock) {
      const users = error.fields?.filter((elem: any) => elem.key === 'usernames')
      const usernames = [users[0].value]
      const acts = maybeNavigateAwayFromSendForm()
      acts.push(
        RouteTreeGen.createNavigateAppend({
          path: [{props: {source: 'walletsRequest', usernames}, selected: 'contactRestricted'}],
        })
      )
      return acts
    } else if (error instanceof RPCError) {
      logger.error(`requestPayment error: ${error.message}`)
      throw error
    }
  }
  return false
}

const startPayment = async (state: Container.TypedState) => {
  if (!state.wallets.acceptedDisclaimer || state.wallets.building.isRequest) {
    return null
  }
  const bid = await RPCStellarTypes.localStartBuildPaymentLocalRpcPromise()
  return WalletsGen.createBuildingPaymentIDReceived({bid})
}

const reviewPayment = async (state: Container.TypedState) => {
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
    } else if (error instanceof RPCError) {
      return WalletsGen.createSentPaymentError({error: error.desc})
    }
  }
  return
}

const stopPayment = async (state: Container.TypedState) =>
  RPCStellarTypes.localStopBuildPaymentLocalRpcPromise({bid: state.wallets.building.bid})

const validateSEP7Link = async (_: unknown, action: WalletsGen.ValidateSEP7LinkPayload) => {
  try {
    const tx = await RPCStellarTypes.localValidateStellarURILocalRpcPromise({inputURI: action.payload.link})
    return [
      WalletsGen.createSetSEP7Tx({
        confirmURI: action.payload.link,
        fromQR: action.payload.fromQR,
        tx: Constants.makeSEP7ConfirmInfo(tx),
      }),
      WalletsGen.createValidateSEP7LinkError({error: ''}),
      RouteTreeGen.createClearModals(),
      RouteTreeGen.createNavigateAppend({path: ['sep7Confirm']}),
    ]
  } catch (error) {
    if (!(error instanceof RPCError)) {
      return
    }
    return [
      WalletsGen.createValidateSEP7LinkError({error: error.desc}),
      RouteTreeGen.createClearModals(),
      RouteTreeGen.createNavigateAppend({
        path: [{props: {errorSource: 'sep7'}, selected: 'keybaseLinkError'}],
      }),
    ]
  }
}

const acceptSEP7Tx = async (_: unknown, action: WalletsGen.AcceptSEP7TxPayload) => {
  try {
    await RPCStellarTypes.localApproveTxURILocalRpcPromise(
      {inputURI: action.payload.inputURI},
      Constants.sep7WaitingKey
    )
  } catch (error) {
    if (!(error instanceof RPCError)) {
      return
    }
    return WalletsGen.createSetSEP7SendError({error: error.desc})
  }

  return [RouteTreeGen.createClearModals(), RouteTreeGen.createSwitchTab({tab: Tabs.walletsTab})]
}

const acceptSEP7Path = async (state: Container.TypedState, action: WalletsGen.AcceptSEP7PathPayload) => {
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
    if (!(error instanceof RPCError)) {
      return
    }
    return WalletsGen.createSetSEP7SendError({error: error.desc})
  }

  return [RouteTreeGen.createClearModals(), RouteTreeGen.createSwitchTab({tab: Tabs.walletsTab})]
}

const acceptSEP7Pay = async (_: unknown, action: WalletsGen.AcceptSEP7PayPayload) => {
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
    if (!(error instanceof RPCError)) {
      return
    }
    return WalletsGen.createSetSEP7SendError({error: error.desc})
  }
  return [RouteTreeGen.createClearModals(), RouteTreeGen.createSwitchTab({tab: Tabs.walletsTab})]
}

const clearBuiltPayment = () => WalletsGen.createClearBuiltPayment()
const clearBuiltRequest = () => WalletsGen.createClearBuiltRequest()

const clearBuilding = () => WalletsGen.createClearBuilding()

const clearErrors = () => WalletsGen.createClearErrors()

const loadWalletDisclaimer = async (
  state: Container.TypedState,
  action:
    | ConfigGen.LoadOnStartPayload
    | WalletsGen.LoadAccountsPayload
    | WalletsGen.LoadWalletDisclaimerPayload
) => {
  if (action.type === ConfigGen.loadOnStart && action.payload.phase !== 'startupOrReloginButNotInARush') {
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
  state: Container.TypedState,
  action:
    | WalletsGen.LoadAccountsPayload
    | WalletsGen.CreatedNewAccountPayload
    | WalletsGen.LinkedExistingAccountPayload
    | WalletsGen.DeletedAccountPayload
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
  } catch (error) {
    if (!(error instanceof RPCError)) {
      return
    }
    const msg = `Error: ${error.desc}`
    if (action.type === WalletsGen.loadAccounts && action.payload.reason === 'initial-load') {
      // No need to throw black bars -- handled by Reloadable.
      logger.warn(msg)
      return false
    } else {
      logger.error(msg)
      throw error
    }
  }
}

const handleSelectAccountError = (
  action:
    | WalletsGen.AccountUpdateReceivedPayload
    | WalletsGen.AccountsReceivedPayload
    | WalletsGen.LinkedExistingAccountPayload
    | WalletsGen.LoadAssetsPayload
    | WalletsGen.LoadMobileOnlyModePayload
    | WalletsGen.SelectAccountPayload,
  msg: string,
  err: RPCError
) => {
  const errMsg = `Error ${msg}: ${err.desc}`
  // Assume that for auto-selected we're on the Wallets tab.
  if (
    action.type === WalletsGen.selectAccount &&
    (action.payload.reason === 'user-selected' || action.payload.reason === 'auto-selected')
  ) {
    // No need to throw black bars -- handled by Reloadable.
    logger.warn('selectAccountError', action.type, action.payload.reason, errMsg)
  } else if (action.type === WalletsGen.accountUpdateReceived) {
    logger.warn('selectAccountError', action.type, errMsg)
  } else {
    logger.error('selectAccountError', action.type, errMsg)
    throw err
  }
}

type LoadAssetsActions =
  | WalletsGen.LoadAssetsPayload
  | WalletsGen.SelectAccountPayload
  | WalletsGen.LinkedExistingAccountPayload
  | WalletsGen.AccountUpdateReceivedPayload
  | WalletsGen.AccountsReceivedPayload
const loadAssets = async (state: Container.TypedState, action: LoadAssetsActions) => {
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
      return
  }

  // should be impossible
  if (!accountID) {
    logger.error('loadAssets unexpected empty accountID', action.type)
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
  } catch (error) {
    if (!(error instanceof RPCError)) {
      return
    }
    return handleSelectAccountError(action, 'selecting account', error)
  }
}

const createPaymentsReceived = (
  accountID: Types.AccountID,
  payments: RPCStellarTypes.PaymentsPageLocal | undefined,
  pending: Array<RPCStellarTypes.PaymentOrErrorLocal>,
  allowClearOldestUnread: boolean,
  error: string
) =>
  WalletsGen.createPaymentsReceived({
    accountID,
    allowClearOldestUnread,
    error,
    oldestUnread: payments?.oldestUnread
      ? Types.rpcPaymentIDToPaymentID(payments.oldestUnread)
      : Types.noPaymentID,
    paymentCursor: payments?.cursor ?? null,
    payments: (payments?.payments || [])
      .map(elem => Constants.rpcPaymentResultToPaymentResult(elem, 'history'))
      .filter(Boolean),
    pending:
      pending?.map(elem => Constants.rpcPaymentResultToPaymentResult(elem, 'pending')).filter(Boolean) ?? [],
  })

type LoadPaymentsActions =
  | WalletsGen.LoadPaymentsPayload
  | WalletsGen.SelectAccountPayload
  | WalletsGen.LinkedExistingAccountPayload
const loadPayments = async (state: Container.TypedState, action: LoadPaymentsActions) => {
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
    try {
      const [pending, payments] = await Promise.all([
        RPCStellarTypes.localGetPendingPaymentsLocalRpcPromise({accountID}),
        RPCStellarTypes.localGetPaymentsLocalRpcPromise({accountID}),
      ])
      return createPaymentsReceived(accountID, payments ?? undefined, pending ?? [], true, '')
    } catch (error) {
      if (!(error instanceof RPCError)) {
        return
      }
      const s = `There was an error loading your payment history, please try again: ${error.desc}`
      return createPaymentsReceived(accountID, undefined, [], true, s)
    }
  }
  return false
}

const loadMorePayments = async (state: Container.TypedState, action: WalletsGen.LoadMorePaymentsPayload) => {
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
  return createPaymentsReceived(action.payload.accountID, payments, [], false, '')
}

// We only need to load these once per session
const loadDisplayCurrencies = async (state: Container.TypedState) => {
  if (Constants.displayCurrenciesLoaded(state)) {
    return false
  }
  const res = await RPCStellarTypes.localGetDisplayCurrenciesLocalRpcPromise()
  return WalletsGen.createDisplayCurrenciesReceived({
    currencies: (res || []).map(c => Constants.currencyResultToCurrency(c)),
  })
}

const loadSendAssetChoices = async (_: unknown, action: WalletsGen.LoadSendAssetChoicesPayload) => {
  try {
    const res = await RPCStellarTypes.localGetSendAssetChoicesLocalRpcPromise({
      from: action.payload.from,
      to: action.payload.to,
    })
    // The result is dropped here. See PICNIC-84 for fixing it.
    return res && WalletsGen.createSendAssetChoicesReceived({sendAssetChoices: res})
  } catch (error) {
    if (!(error instanceof RPCError)) {
      return
    }
    logger.warn(`Error: ${error.desc}`)
    return false
  }
}

const loadDisplayCurrency = async (_: unknown, action: WalletsGen.LoadDisplayCurrencyPayload) => {
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

const refreshAssets = (_: unknown, action: WalletsGen.DisplayCurrencyReceivedPayload) =>
  action.payload.accountID ? WalletsGen.createLoadAssets({accountID: action.payload.accountID}) : undefined

const changeDisplayCurrency = async (_: unknown, action: WalletsGen.ChangeDisplayCurrencyPayload) => {
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

const changeAccountName = async (_: unknown, action: WalletsGen.ChangeAccountNamePayload) => {
  const res = await RPCStellarTypes.localChangeWalletAccountNameLocalRpcPromise(
    {
      accountID: action.payload.accountID,
      newName: action.payload.name,
    },
    Constants.changeAccountNameWaitingKey
  )
  return WalletsGen.createChangedAccountName({account: Constants.accountResultToAccount(res)})
}

const deleteAccount = async (_: unknown, action: WalletsGen.DeleteAccountPayload) => {
  await RPCStellarTypes.localDeleteWalletAccountLocalRpcPromise(
    {
      accountID: action.payload.accountID,
      userAcknowledged: 'yes',
    },
    Constants.deleteAccountWaitingKey
  )
  return WalletsGen.createDeletedAccount()
}

const setAccountAsDefault = async (_: unknown, action: WalletsGen.SetAccountAsDefaultPayload) => {
  const accountsAfterUpdate = await RPCStellarTypes.localSetWalletAccountAsDefaultLocalRpcPromise(
    {accountID: action.payload.accountID},
    Constants.setAccountAsDefaultWaitingKey
  )
  return WalletsGen.createDidSetAccountAsDefault({
    accounts: (accountsAfterUpdate || []).map(account => {
      if (!account.accountID) {
        logger.error(`Found empty accountID, name: ${account.name} isDefault: ${String(account.isDefault)}`)
      }
      return Constants.accountResultToAccount(account)
    }),
  })
}

const loadPaymentDetail = async (_: unknown, action: WalletsGen.LoadPaymentDetailPayload) => {
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
  } catch (error) {
    if (!(error instanceof RPCError)) {
      return
    }
    // No need to throw black bars -- handled by Reloadable.
    logger.warn(error.desc)
    return false
  }
}

const markAsRead = async (_: unknown, action: WalletsGen.MarkAsReadPayload) => {
  try {
    await RPCStellarTypes.localMarkAsReadLocalRpcPromise({
      accountID: action.payload.accountID,
      mostRecentID: Types.paymentIDToRPCPaymentID(action.payload.mostRecentID),
    })
  } catch (error) {
    if (!(error instanceof RPCError)) {
      return
    }
    // No need to throw black bars.
    logger.warn(error.desc)
  }
}

const linkExistingAccount = async (_: unknown, action: WalletsGen.LinkExistingAccountPayload) => {
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
  } catch (error) {
    if (!(error instanceof RPCError)) {
      return
    }
    logger.warn(`Error: ${error.desc}`)
    return WalletsGen.createLinkedExistingAccount({
      accountID: Types.noAccountID,
      error: error.desc,
      name,
      secretKey,
    })
  }
}

const validateAccountName = async (_: unknown, action: WalletsGen.ValidateAccountNamePayload) => {
  const {name} = action.payload
  try {
    await RPCStellarTypes.localValidateAccountNameLocalRpcPromise(
      {name},
      Constants.validateAccountNameWaitingKey
    )
    return WalletsGen.createValidatedAccountName({name})
  } catch (error) {
    if (!(error instanceof RPCError)) {
      return
    }
    logger.warn(`Error: ${error.desc}`)
    return WalletsGen.createValidatedAccountName({error: error.desc, name})
  }
}

const validateSecretKey = async (_: unknown, action: WalletsGen.ValidateSecretKeyPayload) => {
  const {secretKey} = action.payload
  try {
    await RPCStellarTypes.localValidateSecretKeyLocalRpcPromise(
      {secretKey: secretKey.stringValue()},
      Constants.validateSecretKeyWaitingKey
    )
    return WalletsGen.createValidatedSecretKey({secretKey})
  } catch (error) {
    if (!(error instanceof RPCError)) {
      return
    }
    logger.warn(`Error: ${error.desc}`)
    return WalletsGen.createValidatedSecretKey({error: error.desc, secretKey})
  }
}

const deletedAccount = (state: Container.TypedState) => {
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
  _: unknown,
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
  _: unknown,
  action: WalletsGen.DidSetAccountAsDefaultPayload | WalletsGen.ChangedAccountNamePayload
) => {
  if (action.type === WalletsGen.changedAccountName && action.payload.error) {
    // we don't want to nav on error
    return false
  }
  return RouteTreeGen.createNavigateUp()
}

const navigateToAccount = (_: unknown, action: WalletsGen.SelectAccountPayload) => {
  if (!action.payload.show) {
    // we don't want to show, don't nav
    return false
  }

  return [
    RouteTreeGen.createClearModals(),
    RouteTreeGen.createSwitchTab({tab: Constants.rootWalletTab}),
    RouteTreeGen.createNavUpToScreen({
      name: Container.isMobile ? SettingsConstants.walletsTab : 'walletsRoot',
    }),
  ]
}

const navigateToTransaction = (_: unknown, action: WalletsGen.ShowTransactionPayload) => {
  const {accountID, paymentID} = action.payload
  const actions: Array<Container.TypedActions> = [
    WalletsGen.createSelectAccount({accountID, reason: 'show-transaction'}),
  ]
  actions.push(
    RouteTreeGen.createNavigateAppend({
      path: [{props: {accountID, paymentID}, selected: 'transactionDetails'}],
    })
  )
  return actions
}

const exportSecretKey = async (_: unknown, action: WalletsGen.ExportSecretKeyPayload) => {
  const res = await RPCStellarTypes.localGetWalletAccountSecretKeyLocalRpcPromise({
    accountID: action.payload.accountID,
  })
  return WalletsGen.createSecretKeyReceived({
    accountID: action.payload.accountID,
    secretKey: new HiddenString(res),
  })
}

const maybeSelectDefaultAccount = (state: Container.TypedState, _: WalletsGen.AccountsReceivedPayload) => {
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

const cancelPayment = async (state: Container.TypedState, action: WalletsGen.CancelPaymentPayload) => {
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
  } catch (error) {
    if (!(error instanceof RPCError)) {
      return
    }
    logger.error(`failed to cancel payment with ID ${pid}. Error: ${error.message}`)
    throw error
  }
}

const cancelRequest = async (_: unknown, action: WalletsGen.CancelRequestPayload) => {
  try {
    await RPCStellarTypes.localCancelRequestLocalRpcPromise({reqID: action.payload.requestID})
  } catch (error) {
    if (!(error instanceof RPCError)) {
      return
    }
    logger.error(`Error: ${error.message}`)
    return
  }
}

const maybeNavigateAwayFromSendForm = () => {
  const path = Router2Constants.getModalStack()
  const actions: Array<Container.TypedActions> = []
  // pop off any routes that are part of the popup
  path.reverse().some(p => {
    if (Constants.sendRequestFormRoutes.includes(p.name)) {
      actions.push(RouteTreeGen.createNavigateUp())
      return false
    }
    // we're done
    return true
  })
  return actions
}

const maybeNavigateToConversationFromPayment = (_: unknown, action: WalletsGen.SentPaymentPayload) => {
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

const maybeNavigateToConversationFromRequest = (_: unknown, action: WalletsGen.RequestedPaymentPayload) => {
  logger.info('Navigating to conversation because we requested a payment')
  return Chat2Gen.createPreviewConversation({
    participants: [action.payload.requestee],
    reason: 'requestedPayment',
  })
}

const accountDetailsUpdate = (_: unknown, action: EngineGen.Stellar1NotifyAccountDetailsUpdatePayload) =>
  WalletsGen.createAccountUpdateReceived({
    account: Constants.accountResultToAccount(action.payload.params.account),
  })

const accountsUpdate = (_: unknown, action: EngineGen.Stellar1NotifyAccountsUpdatePayload) =>
  WalletsGen.createAccountsReceived({
    accounts: (action.payload.params.accounts || []).map(account => {
      if (!account.accountID) {
        logger.error(`Found empty accountID, name: ${account.name} isDefault: ${String(account.isDefault)}`)
      }
      return Constants.accountResultToAccount(account)
    }),
  })

const pendingPaymentsUpdate = (_: unknown, action: EngineGen.Stellar1NotifyPendingPaymentsUpdatePayload) => {
  const {accountID: _accountID, pending: _pending} = action.payload.params
  if (!_pending) {
    logger.warn(`no pending payments in payload`)
    return false
  }
  const accountID = Types.stringToAccountID(_accountID)
  const pending = _pending.map(p => Constants.rpcPaymentResultToPaymentResult(p, 'pending'))
  return WalletsGen.createPendingPaymentsReceived({accountID, pending})
}

const recentPaymentsUpdate = (_: unknown, action: EngineGen.Stellar1NotifyRecentPaymentsUpdatePayload) => {
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

const paymentReviewed = (_: unknown, action: EngineGen.Stellar1UiPaymentReviewedPayload) => {
  const {
    msg: {bid, reviewID, seqno, banners, nextButton},
  } = action.payload.params
  return WalletsGen.createReviewedPaymentReceived({banners, bid, nextButton, reviewID, seqno})
}

// maybe just clear always?
const maybeClearErrors = () => WalletsGen.createClearErrors()

const receivedBadgeState = (_: unknown, action: NotificationsGen.ReceivedBadgeStatePayload) =>
  WalletsGen.createBadgesUpdated({accounts: action.payload.badgeState.unreadWalletAccounts || []})

const acceptDisclaimer = async () =>
  RPCStellarTypes.localAcceptDisclaimerLocalRpcPromise(undefined, Constants.acceptDisclaimerWaitingKey).catch(
    () => {
      // disclaimer screen handles showing error
      // reset delay state
      return WalletsGen.createResetAcceptingDisclaimer()
    }
  )

const checkDisclaimer = async () => {
  try {
    const accepted = await RPCStellarTypes.localHasAcceptedDisclaimerLocalRpcPromise()
    const actions: Array<Container.TypedActions> = [WalletsGen.createWalletDisclaimerReceived({accepted})]
    if (!accepted) {
      return actions
    }

    // in new nav we could be in a modal anywhere in the app right now
    actions.push(RouteTreeGen.createClearModals())
    actions.push(RouteTreeGen.createSwitchTab({tab: Constants.rootWalletTab}))
    if (Container.isMobile) {
      actions.push(RouteTreeGen.createNavigateAppend({path: [SettingsConstants.walletsTab]}))
    }
    return actions
  } catch (error) {
    if (!(error instanceof RPCError)) {
      return
    }
    logger.error(`Error checking wallet disclaimer: ${error.message}`)
    return false
  }
}

const rejectDisclaimer = () => {
  if (Container.isMobile) {
    if (isTablet) {
      return RouteTreeGen.createSwitchTab({tab: Tabs.peopleTab})
    }
    return RouteTreeGen.createNavigateUp()
  }
  return RouteTreeGen.createSwitchTab({tab: Tabs.peopleTab})
}

const loadMobileOnlyMode = async (
  _: unknown,
  action: WalletsGen.LoadMobileOnlyModePayload | WalletsGen.SelectAccountPayload
) => {
  const accountID = action.payload.accountID
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
  } catch (error) {
    if (!(error instanceof RPCError)) {
      return
    }
    handleSelectAccountError(action, 'loading mobile only mode', error)
    return false
  }
}

const changeMobileOnlyMode = async (_: unknown, action: WalletsGen.ChangeMobileOnlyModePayload) => {
  const accountID = action.payload.accountID
  const f = action.payload.enabled
    ? RPCStellarTypes.localSetAccountMobileOnlyLocalRpcPromise
    : RPCStellarTypes.localSetAccountAllDevicesLocalRpcPromise
  await f({accountID}, Constants.setAccountMobileOnlyWaitingKey(accountID))
  return WalletsGen.createLoadedMobileOnlyMode({
    accountID: accountID,
    enabled: action.payload.enabled,
  })
}

const writeLastSentXLM = async (state: Container.TypedState, action: WalletsGen.SetLastSentXLMPayload) => {
  if (action.payload.writeFile) {
    logger.info(`Writing config stellar.lastSentXLM: ${String(state.wallets.lastSentXLM)}`)
    try {
      await RPCTypes.configGuiSetValueRpcPromise({
        path: 'stellar.lastSentXLM',
        value: {b: state.wallets.lastSentXLM, isNull: false},
      })
      return
    } catch (error) {
      if (!(error instanceof RPCError)) {
        return
      }
      logger.error(`Error: ${error.message}`)
      return false
    }
  }
  return
}

const readLastSentXLM = async () => {
  logger.info(`Reading config`)
  try {
    const result = await RPCTypes.configGuiGetValueRpcPromise({path: 'stellar.lastSentXLM'})
    const value = !result.isNull && !!result.b
    logger.info(`Successfully read config: ${String(value)}`)
    return WalletsGen.createSetLastSentXLM({lastSentXLM: value, writeFile: false})
  } catch (error) {
    if (!(error instanceof RPCError)) {
      return
    }
    if (!error.message.includes('no such key')) {
      logger.error(`Error reading config: ${error.message}`)
    }
    return false
  }
}

const exitFailedPayment = (state: Container.TypedState) => {
  const accountID = state.wallets.builtPayment.from
  return [
    WalletsGen.createAbandonPayment(),
    WalletsGen.createSelectAccount({accountID, reason: 'auto-selected', show: true}),
    WalletsGen.createLoadPayments({accountID}),
  ]
}

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
  useSep24: false,
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

const refreshTrustlineAcceptedAssets = async (
  _: unknown,
  action: WalletsGen.RefreshTrustlineAcceptedAssetsPayload
) => {
  const {accountID} = action.payload
  if (!Types.isValidAccountID(accountID)) {
    return false
  }
  const balances = await RPCStellarTypes.localGetTrustlinesLocalRpcPromise(
    {accountID},
    Constants.refreshTrustlineAcceptedAssetsWaitingKey(accountID)
  )
  return balancesToAction(balances || [], accountID, '')
}

const refreshTrustlineAcceptedAssetsByUsername = async (
  _: unknown,
  action: WalletsGen.RefreshTrustlineAcceptedAssetsByUsernamePayload
) => {
  const {username} = action.payload
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

const addTrustline = async (state: Container.TypedState, action: WalletsGen.AddTrustlinePayload) => {
  const {accountID, assetID} = action.payload
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
  } catch (error) {
    if (!(error instanceof RPCError)) {
      return
    }
    logger.warn(`Error: ${error.desc}`)
    return [WalletsGen.createChangedTrustline({error: error.desc}), refresh]
  }
}

const deleteTrustline = async (state: Container.TypedState, action: WalletsGen.DeleteTrustlinePayload) => {
  const {accountID, assetID} = action.payload
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
  } catch (error) {
    if (!(error instanceof RPCError)) {
      return
    }
    logger.warn(`Error: ${error.desc}`)
    return [WalletsGen.createChangedTrustline({error: error.desc}), refresh]
  }
}

let lastSearchText = ''
const searchTrustlineAssets = async (_: unknown, action: WalletsGen.SetTrustlineSearchTextPayload) => {
  const {text} = action.payload
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
  state: Container.TypedState,
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
  } catch (error) {
    if (!(error instanceof RPCError)) {
      return
    }
    let errorMessage = 'Error finding a path to convert these 2 assets.'
    if (error?.desc) {
      errorMessage = error.desc
    }
    if (error?.code === RPCTypes.StatusCode.scapinetworkerror) {
      errorMessage = 'Network error.'
    }
    if (error?.desc === 'no payment path found') {
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

const sendPaymentAdvanced = async (state: Container.TypedState) => {
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

const assetDeposit = async (_: unknown, action: WalletsGen.AssetDepositPayload) => {
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
  } catch (error) {
    if (!(error instanceof RPCError)) {
      return
    }
    return handleSEP6Error(error)
  }
}

const assetWithdraw = async (_: unknown, action: WalletsGen.AssetWithdrawPayload) => {
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
  } catch (error) {
    if (!(error instanceof RPCError)) {
      return
    }
    return handleSEP6Error(error)
  }
}

const loadStaticConfig = async (
  state: Container.TypedState,
  action: ConfigGen.DaemonHandshakePayload,
  listenerApi: Container.ListenerApi
) => {
  if (state.wallets.staticConfig) {
    return false
  }
  listenerApi.dispatch(
    ConfigGen.createDaemonHandshakeWait({
      increment: true,
      name: 'wallets.loadStatic',
      version: action.payload.version,
    })
  )

  try {
    const res = await RPCStellarTypes.localGetStaticConfigLocalRpcPromise()
    listenerApi.dispatch(WalletsGen.createStaticConfigLoaded({staticConfig: res}))
  } finally {
    listenerApi.dispatch(
      ConfigGen.createDaemonHandshakeWait({
        increment: false,
        name: 'wallets.loadStatic',
        version: action.payload.version,
      })
    )
  }
  return false
}

const onTeamBuildingAdded = (_: Container.TypedState, action: TeamBuildingGen.AddUsersToTeamSoFarPayload) => {
  const {users} = action.payload
  const user = users[0]
  if (!user) return false

  const username = user.id
  return [
    TeamBuildingGen.createCancelTeamBuilding({namespace: 'wallets'}),
    WalletsGen.createSetBuildingTo({to: username}),
  ]
}

const initWallets = () => {
  Container.listenAction(WalletsGen.createNewAccount, createNewAccount)
  Container.listenAction(
    [
      WalletsGen.loadAccounts,
      WalletsGen.createdNewAccount,
      WalletsGen.linkedExistingAccount,
      WalletsGen.deletedAccount,
    ],
    loadAccounts
  )
  Container.listenAction(
    [
      WalletsGen.loadAssets,
      WalletsGen.selectAccount,
      WalletsGen.linkedExistingAccount,
      WalletsGen.accountUpdateReceived,
      WalletsGen.accountsReceived,
    ],
    loadAssets
  )
  Container.listenAction(
    [WalletsGen.loadPayments, WalletsGen.selectAccount, WalletsGen.linkedExistingAccount],
    loadPayments
  )
  Container.listenAction(WalletsGen.loadMorePayments, loadMorePayments)
  Container.listenAction(WalletsGen.deleteAccount, deleteAccount)
  Container.listenAction(WalletsGen.loadPaymentDetail, loadPaymentDetail)
  Container.listenAction(WalletsGen.markAsRead, markAsRead)
  Container.listenAction(WalletsGen.linkExistingAccount, linkExistingAccount)
  Container.listenAction(WalletsGen.validateAccountName, validateAccountName)
  Container.listenAction(WalletsGen.validateSecretKey, validateSecretKey)
  Container.listenAction(WalletsGen.exportSecretKey, exportSecretKey)
  Container.listenAction(
    [WalletsGen.loadDisplayCurrencies, WalletsGen.openSendRequestForm],
    loadDisplayCurrencies
  )
  Container.listenAction(WalletsGen.loadSendAssetChoices, loadSendAssetChoices)
  Container.listenAction(WalletsGen.loadDisplayCurrency, loadDisplayCurrency)
  Container.listenAction(WalletsGen.loadExternalPartners, loadExternalPartners)
  Container.listenAction(WalletsGen.displayCurrencyReceived, refreshAssets)
  Container.listenAction(WalletsGen.changeDisplayCurrency, changeDisplayCurrency)
  Container.listenAction(WalletsGen.setAccountAsDefault, setAccountAsDefault)
  Container.listenAction(WalletsGen.changeAccountName, changeAccountName)
  Container.listenAction(WalletsGen.selectAccount, navigateToAccount)
  Container.listenAction(WalletsGen.showTransaction, navigateToTransaction)
  Container.listenAction([WalletsGen.didSetAccountAsDefault, WalletsGen.changedAccountName], navigateUp)
  Container.listenAction(
    [WalletsGen.createdNewAccount, WalletsGen.linkedExistingAccount],
    createdOrLinkedAccount
  )
  Container.listenAction(WalletsGen.accountsReceived, maybeSelectDefaultAccount)

  // We don't call this for publicMemo/secretNote so the button doesn't
  // spinner as you type
  Container.listenAction(WalletsGen.buildPayment, buildPayment)
  Container.listenAction(
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
  Container.listenAction(WalletsGen.openSendRequestForm, openSendRequestForm)
  Container.listenAction(WalletsGen.reviewPayment, reviewPayment)
  Container.listenAction(WalletsGen.openSendRequestForm, startPayment)
  Container.listenAction(WalletsGen.accountsReceived, maybePopulateBuildingCurrency)

  Container.listenAction(WalletsGen.deletedAccount, deletedAccount)

  Container.listenAction(WalletsGen.sendPayment, sendPayment)
  Container.listenAction([WalletsGen.sentPayment, WalletsGen.requestedPayment], setLastSentXLM)
  Container.listenAction([WalletsGen.sentPayment, WalletsGen.requestedPayment], clearBuilding)
  Container.listenAction(WalletsGen.sentPayment, clearBuiltPayment)
  Container.listenAction([WalletsGen.sentPayment, WalletsGen.abandonPayment], clearErrors)

  Container.listenAction([WalletsGen.abandonPayment], maybeNavigateAwayFromSendForm)

  Container.listenAction([WalletsGen.sentPayment], maybeNavigateToConversationFromPayment)

  Container.listenAction(WalletsGen.requestPayment, requestPayment)
  Container.listenAction([WalletsGen.requestedPayment, WalletsGen.abandonPayment], clearBuiltRequest)
  Container.listenAction(WalletsGen.requestedPayment, maybeNavigateToConversationFromRequest)

  // Effects of abandoning payments
  Container.listenAction(WalletsGen.abandonPayment, stopPayment)

  Container.listenAction(WalletsGen.exitFailedPayment, exitFailedPayment)
  Container.listenAction(WalletsGen.cancelRequest, cancelRequest)
  Container.listenAction(WalletsGen.cancelPayment, cancelPayment)

  // Clear some errors on navigateUp, clear new txs on switchTab
  Container.listenAction(RouteTreeGen.navigateUp, maybeClearErrors)

  Container.listenAction(NotificationsGen.receivedBadgeState, receivedBadgeState)

  Container.listenAction(
    [ConfigGen.loadOnStart, WalletsGen.loadAccounts, WalletsGen.loadWalletDisclaimer],
    loadWalletDisclaimer
  )
  Container.listenAction(WalletsGen.acceptDisclaimer, acceptDisclaimer)
  Container.listenAction(WalletsGen.checkDisclaimer, checkDisclaimer)
  Container.listenAction(WalletsGen.rejectDisclaimer, rejectDisclaimer)

  Container.listenAction([WalletsGen.loadMobileOnlyMode, WalletsGen.selectAccount], loadMobileOnlyMode)
  Container.listenAction(WalletsGen.changeMobileOnlyMode, changeMobileOnlyMode)
  Container.listenAction(WalletsGen.setLastSentXLM, writeLastSentXLM)
  Container.listenAction(ConfigGen.daemonHandshakeDone, readLastSentXLM)
  Container.listenAction(EngineGen.stellar1NotifyAccountDetailsUpdate, accountDetailsUpdate)
  Container.listenAction(EngineGen.stellar1NotifyAccountsUpdate, accountsUpdate)
  Container.listenAction(EngineGen.stellar1NotifyPendingPaymentsUpdate, pendingPaymentsUpdate)

  Container.listenAction(EngineGen.stellar1NotifyRecentPaymentsUpdate, recentPaymentsUpdate)
  Container.listenAction(EngineGen.stellar1UiPaymentReviewed, paymentReviewed)
  Container.listenAction(WalletsGen.validateSEP7Link, validateSEP7Link)

  Container.listenAction(WalletsGen.acceptSEP7Pay, acceptSEP7Pay)
  Container.listenAction(WalletsGen.acceptSEP7Path, acceptSEP7Path)
  Container.listenAction(WalletsGen.acceptSEP7Tx, acceptSEP7Tx)

  Container.listenAction(WalletsGen.refreshTrustlineAcceptedAssets, refreshTrustlineAcceptedAssets)
  Container.listenAction(
    WalletsGen.refreshTrustlineAcceptedAssetsByUsername,
    refreshTrustlineAcceptedAssetsByUsername
  )
  Container.listenAction(WalletsGen.refreshTrustlinePopularAssets, refreshTrustlinePopularAssets)
  Container.listenAction(WalletsGen.addTrustline, addTrustline)
  Container.listenAction(WalletsGen.deleteTrustline, deleteTrustline)
  Container.listenAction(WalletsGen.setTrustlineSearchText, searchTrustlineAssets)
  Container.listenAction(WalletsGen.calculateBuildingAdvanced, calculateBuildingAdvanced)
  Container.listenAction(WalletsGen.sendPaymentAdvanced, sendPaymentAdvanced)
  Container.listenAction(ConfigGen.daemonHandshake, loadStaticConfig)
  Container.listenAction(WalletsGen.assetDeposit, assetDeposit)
  Container.listenAction(WalletsGen.assetWithdraw, assetWithdraw)
  commonListenActions('wallets')
  Container.listenAction(TeamBuildingGen.addUsersToTeamSoFar, filterForNs('wallets', onTeamBuildingAdded))
}

export default initWallets
