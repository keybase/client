import logger from '../logger'
import type * as TeamBuildingGen from '../actions/team-building-gen'
import * as Constants from '../constants/wallets'
import * as Container from '../util/container'
import * as Types from '../constants/types/wallets'
import * as WalletsGen from '../actions/wallets-gen'
import HiddenString from '../util/hidden-string'
import {editTeambuildingDraft} from './team-building'
import {teamBuilderReducerCreator} from '../team-building/reducer-helper'
import shallowEqual from 'shallowequal'
import {mapEqual} from '../util/map'

const initialState: Types.State = Constants.makeState()

const updateAssetMap = (
  assetMap: Map<Types.AssetID, Types.AssetDescription>,
  assets: Array<Types.AssetDescription>
) =>
  assets.forEach(asset => {
    const key = Types.assetDescriptionToAssetID(asset)
    const oldAsset = assetMap.get(key)
    if (!shallowEqual(asset, oldAsset)) {
      assetMap.set(key, asset)
    }
  })

type Actions = WalletsGen.Actions | TeamBuildingGen.Actions
export default Container.makeReducer<Actions, Types.State>(initialState, {
  [WalletsGen.resetStore]: draftState => {
    return {...initialState, staticConfig: draftState.staticConfig} as Types.State
  },
  [WalletsGen.didSetAccountAsDefault]: (draftState, action) => {
    draftState.accountMap = new Map(action.payload.accounts.map(account => [account.accountID, account]))
  },
  [WalletsGen.accountsReceived]: (draftState, action) => {
    draftState.accountMap = new Map(action.payload.accounts.map(account => [account.accountID, account]))
  },
  [WalletsGen.changedAccountName]: (draftState, action) => {
    const {account} = action.payload
    // accept the updated account if we've loaded it already
    // this is because we get the sort order from the full accounts load,
    // and can't figure it out from these notifications alone.
    if (account) {
      // } && state.accountMap.get(account.accountID)) {
      const {accountID} = account
      const old = draftState.accountMap.get(accountID)
      if (old) {
        draftState.accountMap.set(accountID, {...old, ...account})
      }
    }
  },
  [WalletsGen.accountUpdateReceived]: (draftState, action) => {
    const {account} = action.payload
    // accept the updated account if we've loaded it already
    // this is because we get the sort order from the full accounts load,
    // and can't figure it out from these notifications alone.
    if (account) {
      const {accountID} = account
      const old = draftState.accountMap.get(accountID)
      if (old) {
        draftState.accountMap.set(accountID, {...old, ...account})
      }
    }
  },
  [WalletsGen.assetsReceived]: (draftState, action) => {
    draftState.assetsMap.set(action.payload.accountID, action.payload.assets)
  },
  [WalletsGen.buildPayment]: draftState => {
    draftState.buildCounter++
  },
  [WalletsGen.builtPaymentReceived]: (draftState, action) => {
    if (action.payload.forBuildCounter === draftState.buildCounter) {
      draftState.builtPayment = {
        ...draftState.builtPayment,
        ...Constants.makeBuiltPayment(action.payload.build),
      }
    }
  },
  [WalletsGen.builtRequestReceived]: (draftState, action) => {
    if (action.payload.forBuildCounter === draftState.buildCounter) {
      draftState.builtRequest = {
        ...draftState.builtRequest,
        ...Constants.makeBuiltRequest(action.payload.build),
      }
    }
  },
  [WalletsGen.openSendRequestForm]: (draftState, action) => {
    if (!draftState.acceptedDisclaimer) {
      return
    }
    draftState.building = {
      ...Constants.makeBuilding(),
      amount: action.payload.amount || '',
      currency:
        action.payload.currency || // explicitly set
        (draftState.lastSentXLM && 'XLM') || // lastSentXLM override
        (action.payload.from &&
          Constants.getDisplayCurrencyInner(draftState as Types.State, action.payload.from).code) || // display currency of explicitly set 'from' account
        Constants.getDefaultDisplayCurrencyInner(draftState as Types.State).code || // display currency of default account
        '', // Empty string -> not loaded
      from: action.payload.from || Types.noAccountID,
      isRequest: !!action.payload.isRequest,
      publicMemo: action.payload.publicMemo || new HiddenString(''),
      recipientType: action.payload.recipientType || 'keybaseUser',
      secretNote: action.payload.secretNote || new HiddenString(''),
      to: action.payload.to || '',
    }
    draftState.builtPayment = Constants.makeBuiltPayment()
    draftState.builtRequest = Constants.makeBuiltRequest()
    draftState.sentPaymentError = ''
  },
  [WalletsGen.abandonPayment]: draftState => {
    draftState.building = Constants.makeBuilding()
  },
  [WalletsGen.clearBuilding]: draftState => {
    draftState.building = Constants.makeBuilding()
  },
  [WalletsGen.clearBuiltPayment]: draftState => {
    draftState.builtPayment = Constants.makeBuiltPayment()
  },
  [WalletsGen.clearBuiltRequest]: draftState => {
    draftState.builtRequest = Constants.makeBuiltRequest()
  },
  [WalletsGen.externalPartnersReceived]: (draftState, action) => {
    draftState.externalPartners = action.payload.externalPartners
  },
  [WalletsGen.paymentDetailReceived]: (draftState, action) => {
    const emptyMap: Map<Types.PaymentID, Types.Payment> = new Map()
    const map = draftState.paymentsMap.get(action.payload.accountID) ?? emptyMap

    const paymentDetail = action.payload.payment
    map.set(paymentDetail.id, {
      ...(map.get(paymentDetail.id) ?? Constants.makePayment()),
      ...action.payload.payment,
    })

    draftState.paymentsMap.set(action.payload.accountID, map)
  },
  [WalletsGen.paymentsReceived]: (draftState, action) => {
    const emptyMap: Map<Types.PaymentID, Types.Payment> = new Map()
    const map = draftState.paymentsMap.get(action.payload.accountID) ?? emptyMap

    const paymentResults = [...action.payload.payments, ...action.payload.pending]
    paymentResults.forEach(paymentResult => {
      map.set(paymentResult.id, {
        ...(map.get(paymentResult.id) ?? Constants.makePayment()),
        ...paymentResult,
      })
    })
    draftState.loadPaymentsError = action.payload.error
    draftState.paymentsMap.set(action.payload.accountID, map)
    draftState.paymentCursorMap.set(action.payload.accountID, action.payload.paymentCursor)
    draftState.paymentLoadingMoreMap.set(action.payload.accountID, false)
    // allowClearOldestUnread dictates whether this action is allowed to delete the value of oldestUnread.
    // GetPaymentsLocal can erroneously return an empty oldestUnread value when a non-latest page is requested
    // and oldestUnread points into the latest page.
    if (
      action.payload.allowClearOldestUnread ||
      (action.payload.oldestUnread || Types.noPaymentID) !== Types.noPaymentID
    ) {
      draftState.paymentOldestUnreadMap.set(action.payload.accountID, action.payload.oldestUnread)
    }
  },
  [WalletsGen.pendingPaymentsReceived]: (draftState, action) => {
    const newPending = action.payload.pending.map(p => [p.id, Constants.makePayment(p)] as const)
    const emptyMap: Map<Types.PaymentID, Types.Payment> = new Map()
    const oldFiltered = [
      ...(draftState.paymentsMap.get(action.payload.accountID) ?? emptyMap).entries(),
    ].filter(([_k, v]) => v.section !== 'pending')
    const val = new Map([...oldFiltered, ...newPending])
    draftState.paymentsMap.set(action.payload.accountID, val)
  },
  [WalletsGen.recentPaymentsReceived]: (draftState, action) => {
    const newPayments = action.payload.payments.map(p => [p.id, Constants.makePayment(p)] as const)
    const emptyMap: Map<Types.PaymentID, Types.Payment> = new Map()
    const old = (draftState.paymentsMap.get(action.payload.accountID) ?? emptyMap).entries()

    draftState.paymentsMap.set(action.payload.accountID, new Map([...old, ...newPayments]))
    draftState.paymentCursorMap.set(
      action.payload.accountID,
      draftState.paymentCursorMap.get(action.payload.accountID) || action.payload.paymentCursor
    )
    draftState.paymentOldestUnreadMap.set(action.payload.accountID, action.payload.oldestUnread)
  },
  [WalletsGen.displayCurrenciesReceived]: (draftState, action) => {
    draftState.currencies = action.payload.currencies
  },
  [WalletsGen.displayCurrencyReceived]: (draftState, action) => {
    const account = Constants.getAccountInner(
      draftState as Types.State,
      action.payload.accountID || Types.noAccountID
    )
    if (account.accountID === Types.noAccountID) {
      return
    }
    draftState.accountMap.set(account.accountID, {...account, displayCurrency: action.payload.currency})
  },
  [WalletsGen.reviewPayment]: draftState => {
    draftState.builtPayment.reviewBanners = []
    draftState.reviewCounter++
    draftState.reviewLastSeqno = undefined
  },
  [WalletsGen.reviewedPaymentReceived]: (draftState, action) => {
    // paymentReviewed notifications can arrive out of order, so check their freshness.
    const {bid, reviewID, seqno, banners, nextButton} = action.payload
    const useable =
      draftState.building.bid === bid &&
      draftState.reviewCounter === reviewID &&
      (draftState.reviewLastSeqno || 0) <= seqno
    if (!useable) {
      logger.info(`ignored stale reviewPaymentReceived`)
      return
    }

    draftState.builtPayment.readyToSend = nextButton
    draftState.builtPayment.reviewBanners = banners ?? null
    draftState.reviewLastSeqno = seqno
  },
  [WalletsGen.secretKeyReceived]: (draftState, action) => {
    draftState.exportedSecretKey = action.payload.secretKey
    draftState.exportedSecretKeyAccountID = draftState.selectedAccount
  },
  [WalletsGen.secretKeySeen]: draftState => {
    draftState.exportedSecretKey = new HiddenString('')
    draftState.exportedSecretKeyAccountID = Types.noAccountID
  },
  [WalletsGen.selectAccount]: (draftState, action) => {
    if (!action.payload.accountID) {
      logger.error('Selecting empty account ID')
    }
    draftState.exportedSecretKey = new HiddenString('')
    const old = draftState.selectedAccount
    draftState.selectedAccount = action.payload.accountID
    // we clear the old selected payments and cursors
    if (!old) {
      return
    }

    draftState.paymentCursorMap.delete(old)
    draftState.paymentsMap.delete(old)
  },
  [WalletsGen.setBuildingAmount]: (draftState, action) => {
    draftState.building.amount = action.payload.amount
    draftState.builtPayment.amountErrMsg = ''
    draftState.builtPayment.worthDescription = ''
    draftState.builtPayment.worthInfo = ''
    draftState.builtRequest.amountErrMsg = ''
    draftState.builtRequest.worthDescription = ''
    draftState.builtRequest.worthInfo = ''
  },
  [WalletsGen.setBuildingCurrency]: (draftState, action) => {
    draftState.building.currency = action.payload.currency
    draftState.builtPayment = Constants.makeBuiltPayment()
  },
  [WalletsGen.setBuildingFrom]: (draftState, action) => {
    draftState.building.from = action.payload.from
    draftState.builtPayment = Constants.makeBuiltPayment()
  },
  [WalletsGen.setBuildingIsRequest]: (draftState, action) => {
    draftState.building.isRequest = action.payload.isRequest
    draftState.builtPayment = Constants.makeBuiltPayment()
    draftState.builtRequest = Constants.makeBuiltRequest()
  },
  [WalletsGen.setBuildingPublicMemo]: (draftState, action) => {
    draftState.building.publicMemo = action.payload.publicMemo
    draftState.builtPayment.publicMemoErrMsg = new HiddenString('')
  },
  [WalletsGen.setBuildingRecipientType]: (draftState, action) => {
    draftState.building.recipientType = action.payload.recipientType
    draftState.builtPayment = Constants.makeBuiltPayment()
  },
  [WalletsGen.setBuildingSecretNote]: (draftState, action) => {
    draftState.building.secretNote = action.payload.secretNote
    draftState.builtPayment.secretNoteErrMsg = new HiddenString('')
    draftState.builtRequest.secretNoteErrMsg = new HiddenString('')
  },
  [WalletsGen.setBuildingTo]: (draftState, action) => {
    draftState.building.to = action.payload.to
    draftState.builtPayment.toErrMsg = ''
    draftState.builtRequest.toErrMsg = ''
  },
  [WalletsGen.clearBuildingAdvanced]: draftState => {
    draftState.buildingAdvanced = Constants.emptyBuildingAdvanced
    draftState.builtPaymentAdvanced = Constants.emptyBuiltPaymentAdvanced
  },
  [WalletsGen.setBuildingAdvancedRecipient]: (draftState, action) => {
    draftState.buildingAdvanced.recipient = action.payload.recipient
  },
  [WalletsGen.setBuildingAdvancedRecipientAmount]: (draftState, action) => {
    draftState.buildingAdvanced.recipientAmount = action.payload.recipientAmount
    draftState.builtPaymentAdvanced = Constants.emptyBuiltPaymentAdvanced
  },
  [WalletsGen.setBuildingAdvancedRecipientAsset]: (draftState, action) => {
    draftState.buildingAdvanced.recipientAsset = action.payload.recipientAsset
    draftState.builtPaymentAdvanced = Constants.emptyBuiltPaymentAdvanced
  },
  [WalletsGen.setBuildingAdvancedRecipientType]: (draftState, action) => {
    draftState.buildingAdvanced.recipientType = action.payload.recipientType
  },
  [WalletsGen.setBuildingAdvancedPublicMemo]: (draftState, action) => {
    draftState.buildingAdvanced.publicMemo = action.payload.publicMemo
    // TODO PICNIC-142 clear error when we have that
  },
  [WalletsGen.setBuildingAdvancedSenderAccountID]: (draftState, action) => {
    draftState.buildingAdvanced.senderAccountID = action.payload.senderAccountID
  },
  [WalletsGen.setBuildingAdvancedSenderAsset]: (draftState, action) => {
    draftState.buildingAdvanced.senderAsset = action.payload.senderAsset
    draftState.builtPaymentAdvanced = Constants.emptyBuiltPaymentAdvanced
  },
  [WalletsGen.setBuildingAdvancedSecretNote]: (draftState, action) => {
    draftState.buildingAdvanced.secretNote = action.payload.secretNote
    // TODO PICNIC-142 clear error when we have that
  },
  [WalletsGen.sendAssetChoicesReceived]: (draftState, action) => {
    const {sendAssetChoices} = action.payload
    draftState.building.sendAssetChoices = sendAssetChoices
  },
  [WalletsGen.buildingPaymentIDReceived]: (draftState, action) => {
    const {bid} = action.payload
    draftState.building.bid = bid
  },
  [WalletsGen.setLastSentXLM]: (draftState, action) => {
    draftState.lastSentXLM = action.payload.lastSentXLM
  },
  [WalletsGen.setReadyToReview]: (draftState, action) => {
    draftState.builtPayment.readyToReview = action.payload.readyToReview
  },
  [WalletsGen.validateAccountName]: (draftState, action) => {
    draftState.accountName = action.payload.name
    draftState.accountNameValidationState = 'waiting'
  },
  [WalletsGen.validatedAccountName]: (draftState, action) => {
    if (action.payload.name !== draftState.accountName) {
      // this wasn't from the most recent call
      return
    }
    draftState.accountName = ''
    draftState.accountNameError = action.payload.error ? action.payload.error : ''
    draftState.accountNameValidationState = action.payload.error ? 'error' : 'valid'
  },
  [WalletsGen.validateSecretKey]: (draftState, action) => {
    draftState.secretKey = action.payload.secretKey
    draftState.secretKeyValidationState = 'waiting'
  },
  [WalletsGen.validatedSecretKey]: (draftState, action) => {
    if (action.payload.secretKey.stringValue() !== draftState.secretKey.stringValue()) {
      // this wasn't from the most recent call
      return
    }
    draftState.secretKey = new HiddenString('')
    draftState.secretKeyError = action.payload.error ? action.payload.error : ''
    draftState.secretKeyValidationState = action.payload.error ? 'error' : 'valid'
  },
  [WalletsGen.changedTrustline]: (draftState, action) => {
    draftState.changeTrustlineError = action.payload.error || ''
  },
  [WalletsGen.clearErrors]: draftState => {
    draftState.accountName = ''
    draftState.accountNameError = ''
    draftState.accountNameValidationState = 'none'
    draftState.builtPayment.readyToSend = 'spinning'
    draftState.changeTrustlineError = ''
    draftState.createNewAccountError = ''
    draftState.linkExistingAccountError = ''
    draftState.secretKey = new HiddenString('')
    draftState.secretKeyError = ''
    draftState.secretKeyValidationState = 'none'
    draftState.sentPaymentError = ''
  },
  [WalletsGen.createdNewAccount]: (draftState, action) => {
    if (action.payload.error) {
      draftState.createNewAccountError = action.payload.error ?? ''
    } else {
      draftState.accountName = ''
      draftState.accountNameError = ''
      draftState.accountNameValidationState = 'none'
      draftState.changeTrustlineError = ''
      draftState.createNewAccountError = ''
      draftState.linkExistingAccountError = ''
      draftState.secretKey = new HiddenString('')
      draftState.secretKeyError = ''
      draftState.secretKeyValidationState = 'none'
      draftState.selectedAccount = action.payload.accountID
    }
  },
  [WalletsGen.linkedExistingAccount]: (draftState, action) => {
    if (action.payload.error) {
      draftState.linkExistingAccountError = action.payload.error ?? ''
    } else {
      draftState.accountName = ''
      draftState.accountNameError = ''
      draftState.accountNameValidationState = 'none'
      draftState.createNewAccountError = ''
      draftState.linkExistingAccountError = ''
      draftState.secretKey = new HiddenString('')
      draftState.secretKeyError = ''
      draftState.secretKeyValidationState = 'none'
      draftState.selectedAccount = action.payload.accountID
    }
  },
  [WalletsGen.sentPaymentError]: (draftState, action) => {
    draftState.sentPaymentError = action.payload.error
  },
  [WalletsGen.loadMorePayments]: (draftState, action) => {
    if (draftState.paymentCursorMap.get(action.payload.accountID)) {
      draftState.paymentLoadingMoreMap.set(action.payload.accountID, true)
    }
  },
  [WalletsGen.badgesUpdated]: (draftState, action) => {
    action.payload.accounts.forEach(({accountID, numUnread}) =>
      draftState.unreadPaymentsMap.set(accountID, numUnread)
    )
  },
  [WalletsGen.walletDisclaimerReceived]: (draftState, action) => {
    draftState.acceptedDisclaimer = action.payload.accepted
  },
  [WalletsGen.acceptDisclaimer]: draftState => {
    draftState.acceptingDisclaimerDelay = true
  },
  [WalletsGen.resetAcceptingDisclaimer]: draftState => {
    draftState.acceptingDisclaimerDelay = false
  },
  [WalletsGen.loadedMobileOnlyMode]: (draftState, action) => {
    draftState.mobileOnlyMap.set(action.payload.accountID, action.payload.enabled)
  },
  [WalletsGen.validateSEP7Link]: draftState => {
    // Clear out old state just in [
    draftState.sep7ConfirmError = ''
    draftState.sep7ConfirmInfo = undefined
    draftState.sep7ConfirmPath = Constants.emptyBuiltPaymentAdvanced
    draftState.sep7ConfirmURI = ''
    draftState.sep7SendError = ''
  },
  [WalletsGen.setSEP7SendError]: (draftState, action) => {
    draftState.sep7SendError = action.payload.error
  },
  [WalletsGen.validateSEP7LinkError]: (draftState, action) => {
    draftState.sep7ConfirmError = action.payload.error
  },
  [WalletsGen.setSEP7Tx]: (draftState, action) => {
    draftState.sep7ConfirmInfo = action.payload.tx
    draftState.sep7ConfirmFromQR = action.payload.fromQR
    draftState.sep7ConfirmURI = action.payload.confirmURI
  },
  [WalletsGen.setTrustlineExpanded]: (draftState, action) => {
    if (action.payload.expanded) {
      draftState.trustline.expandedAssets.add(action.payload.assetID)
    } else {
      draftState.trustline.expandedAssets.delete(action.payload.assetID)
    }
  },
  [WalletsGen.setTrustlineAcceptedAssets]: (draftState, action) => {
    const {accountID, limits} = action.payload
    const accountAcceptedAssets = draftState.trustline.acceptedAssets.get(accountID)
    if (!accountAcceptedAssets || !mapEqual(limits, accountAcceptedAssets)) {
      draftState.trustline.acceptedAssets.set(accountID, limits)
    }
    updateAssetMap(draftState.trustline.assetMap, action.payload.assets)
  },
  [WalletsGen.setTrustlineAcceptedAssetsByUsername]: (draftState, action) => {
    const {username, limits, assets} = action.payload
    const accountAcceptedAssets = draftState.trustline.acceptedAssetsByUsername.get(username)
    if (!accountAcceptedAssets || !mapEqual(limits, accountAcceptedAssets)) {
      draftState.trustline.acceptedAssetsByUsername.set(username, limits)
    }
    updateAssetMap(draftState.trustline.assetMap, assets)
  },
  [WalletsGen.setTrustlinePopularAssets]: (draftState, action) => {
    draftState.trustline.popularAssets = action.payload.assets.map(asset =>
      Types.assetDescriptionToAssetID(asset)
    )
    updateAssetMap(draftState.trustline.assetMap, action.payload.assets)
    draftState.trustline.totalAssetsCount = action.payload.totalCount
    draftState.trustline.loaded = true
  },
  [WalletsGen.setTrustlineSearchText]: (draftState, action) => {
    if (!action.payload.text) {
      draftState.trustline.searchingAssets = []
    }
  },
  [WalletsGen.setTrustlineSearchResults]: (draftState, action) => {
    draftState.trustline.searchingAssets = action.payload.assets.map(asset =>
      Types.assetDescriptionToAssetID(asset)
    )
    updateAssetMap(draftState.trustline.assetMap, action.payload.assets)
  },
  [WalletsGen.clearTrustlineSearchResults]: draftState => {
    draftState.trustline.searchingAssets = undefined
  },
  [WalletsGen.setBuiltPaymentAdvanced]: (draftState, action) => {
    if (action.payload.forSEP7) {
      draftState.sep7ConfirmPath = action.payload.builtPaymentAdvanced
    } else {
      draftState.builtPaymentAdvanced = action.payload.builtPaymentAdvanced
    }
  },
  [WalletsGen.staticConfigLoaded]: (draftState, action) => {
    draftState.staticConfig = action.payload.staticConfig
  },
  [WalletsGen.assetDeposit]: draftState => {
    draftState.sep6Error = false
    draftState.sep6Message = ''
  },
  [WalletsGen.assetWithdraw]: draftState => {
    draftState.sep6Error = false
    draftState.sep6Message = ''
  },
  [WalletsGen.setSEP6Message]: (draftState, action) => {
    draftState.sep6Error = action.payload.error
    draftState.sep6Message = action.payload.message
  },
  ...teamBuilderReducerCreator<Types.State>(
    (draftState: Container.Draft<Types.State>, action: TeamBuildingGen.Actions) => {
      const val = editTeambuildingDraft('wallets', draftState.teamBuilding, action)
      if (val !== undefined) {
        draftState.teamBuilding = val
      }
    }
  ),
})
