import logger from '../logger'
import * as TeamBuildingGen from '../actions/team-building-gen'
import * as I from 'immutable'
import * as Constants from '../constants/wallets'
import * as Container from '../util/container'
import * as Types from '../constants/types/wallets'
import * as WalletsGen from '../actions/wallets-gen'
import HiddenString from '../util/hidden-string'
import teamBuildingReducer from './team-building'
import {teamBuilderReducerCreator} from '../team-building/reducer-helper'

import reducerOLD from './wallets-old'
import * as ConstantsOLD from '../constants/wallets-old'

const initialState: Types.State = Constants.makeState()

const reduceAssetMap = (
  assetMap: I.Map<Types.AssetID, Types.AssetDescription>,
  assets: Array<Types.AssetDescription>
): I.Map<Types.AssetID, Types.AssetDescription> =>
  assetMap.withMutations(assetMapMutable =>
    assets.forEach(asset =>
      assetMapMutable.update(Types.assetDescriptionToAssetID(asset), oldAsset =>
        asset.equals(oldAsset) ? oldAsset : asset
      )
    )
  )

type Actions = WalletsGen.Actions | TeamBuildingGen.Actions
const newReducer = Container.makeReducer<Actions, Types.State>(initialState, {
  [WalletsGen.resetStore]: draftState => {
    return {...initialState, staticConfig: draftState.staticConfig}
  },
  [WalletsGen.didSetAccountAsDefault]: (draftState, action) => {
    const accountMap: I.OrderedMap<Types.AccountID, Types.Account> = I.OrderedMap(
      action.payload.accounts.map(account => [account.accountID, account])
    )
    draftState.accountMap = accountMap
  },
  [WalletsGen.accountsReceived]: (draftState, action) => {
    const accountMap: I.OrderedMap<Types.AccountID, Types.Account> = I.OrderedMap(
      action.payload.accounts.map(account => [account.accountID, account])
    )
    draftState.accountMap = accountMap
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
        draftState.accountMap.set(accountID, old.merge(account))
      }
    }
  },
  [WalletsGen.accountUpdateReceived]: (draftState, action) => {
    const {account} = action.payload
    // accept the updated account if we've loaded it already
    // this is because we get the sort order from the full accounts load,
    // and can't figure it out from these notifications alone.
    if (account) {
      // } && state.accountMap.get(account.accountID)) {
      const {accountID} = account
      const old = draftState.accountMap.get(accountID)
      if (old) {
        draftState.accountMap.set(accountID, old.merge(account))
      }
    }
  },
  [WalletsGen.assetsReceived]: (draftState, action) => {
    draftState.assetsMap.set(action.payload.accountID, I.List(action.payload.assets))
  },
  [WalletsGen.buildPayment]: draftState => {
    draftState.buildCounter++
  },
  [WalletsGen.builtPaymentReceived]: (draftState, action) => {
    if (action.payload.forBuildCounter === draftState.buildCounter) {
      draftState.builtPayment = draftState.builtPayment.merge(
        Constants.makeBuiltPayment(action.payload.build)
      )
    }
  },
  [WalletsGen.builtRequestReceived]: (draftState, action) => {
    if (action.payload.forBuildCounter === draftState.buildCounter) {
      draftState.builtRequest = draftState.builtRequest.merge(
        Constants.makeBuiltRequest(action.payload.build)
      )
    }
  },
  [WalletsGen.openSendRequestForm]: (draftState, action) => {
    if (!draftState.acceptedDisclaimer) {
      return
    }
    const initialBuilding = Constants.makeBuilding()
    draftState.building = initialBuilding.merge({
      amount: action.payload.amount || '',
      currency:
        action.payload.currency || // explicitly set
        (draftState.lastSentXLM && 'XLM') || // lastSentXLM override
        (action.payload.from && Constants.getDisplayCurrencyInner(draftState, action.payload.from).code) || // display currency of explicitly set 'from' account
        Constants.getDefaultDisplayCurrencyInner(draftState).code || // display currency of default account
        '', // Empty string -> not loaded
      from: action.payload.from || Types.noAccountID,
      isRequest: !!action.payload.isRequest,
      publicMemo: action.payload.publicMemo || new HiddenString(''),
      recipientType: action.payload.recipientType || 'keybaseUser',
      secretNote: action.payload.secretNote || new HiddenString(''),
      to: action.payload.to || '',
    })
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
    draftState.paymentsMap = draftState.paymentsMap.update(
      action.payload.accountID,
      (paymentsMap = I.Map()) => Constants.updatePaymentDetail(paymentsMap, action.payload.payment)
    )
  },
  [WalletsGen.paymentsReceived]: (draftState, action) => {
    draftState.paymentsMap = draftState.paymentsMap.update(
      action.payload.accountID,
      (paymentsMap = I.Map()) =>
        Constants.updatePaymentsReceived(paymentsMap, [...action.payload.payments, ...action.payload.pending])
    )
    draftState.paymentCursorMap = draftState.paymentCursorMap.set(
      action.payload.accountID,
      action.payload.paymentCursor
    )
    draftState.paymentLoadingMoreMap = draftState.paymentLoadingMoreMap.set(action.payload.accountID, false)
    // allowClearOldestUnread dictates whether this action is allowed to delete the value of oldestUnread.
    // GetPaymentsLocal can erroneously return an empty oldestUnread value when a non-latest page is requested
    // and oldestUnread points into the latest page.
    if (
      action.payload.allowClearOldestUnread ||
      (action.payload.oldestUnread || Types.noPaymentID) !== Types.noPaymentID
    ) {
      draftState.paymentOldestUnreadMap = draftState.paymentOldestUnreadMap.set(
        action.payload.accountID,
        action.payload.oldestUnread
      )
    }
  },
  [WalletsGen.pendingPaymentsReceived]: (draftState, action) => {
    const newPending = I.Map(action.payload.pending.map(p => [p.id, Constants.makePayment().merge(p)]))
    draftState.paymentsMap = draftState.paymentsMap.update(
      action.payload.accountID,
      (paymentsMap = I.Map()) => paymentsMap.filter((p: any) => p.section !== 'pending').merge(newPending)
    )
  },
  [WalletsGen.recentPaymentsReceived]: (draftState, action) => {
    const newPayments = I.Map(action.payload.payments.map(p => [p.id, Constants.makePayment().merge(p)]))
    draftState.paymentsMap = draftState.paymentsMap.update(
      action.payload.accountID,
      (paymentsMap = I.Map()) => paymentsMap.merge(newPayments)
    )
    draftState.paymentCursorMap = draftState.paymentCursorMap.update(
      action.payload.accountID,
      cursor => cursor || action.payload.paymentCursor
    )
    draftState.paymentOldestUnreadMap = draftState.paymentOldestUnreadMap.set(
      action.payload.accountID,
      action.payload.oldestUnread
    )
  },
  [WalletsGen.displayCurrenciesReceived]: (draftState, action) => {
    draftState.currencies = I.List(action.payload.currencies)
  },
  [WalletsGen.displayCurrencyReceived]: (draftState, action) => {
    const account = Constants.getAccountInner(draftState, action.payload.accountID || Types.noAccountID)
    if (account.accountID === Types.noAccountID) {
      return
    }
    draftState.accountMap = draftState.accountMap.set(
      account.accountID,
      account.merge({displayCurrency: action.payload.currency})
    )
  },
  [WalletsGen.reviewPayment]: draftState => {
    draftState.builtPayment = draftState.builtPayment.set('reviewBanners', [])
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

    draftState.builtPayment = draftState.builtPayment.merge({
      readyToSend: nextButton,
      reviewBanners: banners,
    })
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

    draftState.paymentCursorMap = draftState.paymentCursorMap.delete(old)
    draftState.paymentsMap = draftState.paymentsMap.delete(old)
  },
  [WalletsGen.setBuildingAmount]: (draftState, action) => {
    const {amount} = action.payload
      draftState.building= state.building.merge({amount})
      draftState.builtPayment= state.builtPayment.merge({amountErrMsg: '', worthDescription: '', worthInfo: ''})
      draftState.builtRequest= state.builtRequest.merge({amountErrMsg: '', worthDescription: '', worthInfo: ''})
  },
  [WalletsGen.setBuildingCurrency]: (draftState, action) => {
    const {currency} = action.payload
    return {
      ...state,
      building: state.building.merge({currency}),
      builtPayment: Constants.makeBuiltPayment(),
    }
  },
  [WalletsGen.setBuildingFrom]: (draftState, action) => {
    const {from} = action.payload
    return {...state, building: state.building.merge({from}), builtPayment: Constants.makeBuiltPayment()}
  },
  [WalletsGen.setBuildingIsRequest]: (draftState, action) => {
    const {isRequest} = action.payload
    return {
      ...state,
      building: state.building.merge({isRequest}),
      builtPayment: Constants.makeBuiltPayment(),
      builtRequest: Constants.makeBuiltRequest(),
    }
  },
  [WalletsGen.setBuildingPublicMemo]: (draftState, action) => {
    const {publicMemo} = action.payload
    return {
      ...state,
      building: state.building.merge({publicMemo}),
      builtPayment: state.builtPayment.merge({publicMemoErrMsg: new HiddenString('')}),
    }
  },
  [WalletsGen.setBuildingRecipientType]: (draftState, action) => {
    const {recipientType} = action.payload
    return {
      ...state,
      building: state.building.merge({recipientType}),
      builtPayment: Constants.makeBuiltPayment(),
    }
  },
  [WalletsGen.setBuildingSecretNote]: (draftState, action) => {
    const {secretNote} = action.payload
    return {
      ...state,
      building: state.building.merge({secretNote}),
      builtPayment: state.builtPayment.merge({secretNoteErrMsg: new HiddenString('')}),
      builtRequest: state.builtRequest.merge({secretNoteErrMsg: new HiddenString('')}),
    }
  },
  [WalletsGen.setBuildingTo]: (draftState, action) => {
    const {to} = action.payload
    return {
      ...state,
      building: state.building.merge({to}),
      builtPayment: state.builtPayment.merge({toErrMsg: ''}),
      builtRequest: state.builtRequest.merge({toErrMsg: ''}),
    }
  },
  [WalletsGen.clearBuildingAdvanced]: (draftState, action) => {
    return {
      ...state,
      buildingAdvanced: Constants.emptyBuildingAdvanced,
      builtPaymentAdvanced: Constants.emptyBuiltPaymentAdvanced,
    }
  },
  [WalletsGen.setBuildingAdvancedRecipient]: (draftState, action) => {
    return {...state, buildingAdvanced: state.buildingAdvanced.set('recipient', action.payload.recipient)}
  },
  [WalletsGen.setBuildingAdvancedRecipientAmount]: (draftState, action) => {
    return {
      ...state,
      buildingAdvanced: state.buildingAdvanced.set('recipientAmount', action.payload.recipientAmount),
      builtPaymentAdvanced: Constants.emptyBuiltPaymentAdvanced,
    }
  },
  [WalletsGen.setBuildingAdvancedRecipientAsset]: (draftState, action) => {
    return {
      ...state,
      buildingAdvanced: state.buildingAdvanced.set('recipientAsset', action.payload.recipientAsset),
      builtPaymentAdvanced: Constants.emptyBuiltPaymentAdvanced,
    }
  },
  [WalletsGen.setBuildingAdvancedRecipientType]: (draftState, action) => {
    return {
      ...state,
      buildingAdvanced: state.buildingAdvanced.set('recipientType', action.payload.recipientType),
    }
  },
  [WalletsGen.setBuildingAdvancedPublicMemo]: (draftState, action) => {
    return {
      ...state,
      buildingAdvanced: state.buildingAdvanced.set('publicMemo', action.payload.publicMemo),
      // TODO PICNIC-142 clear error when we have that
    }
  },
  [WalletsGen.setBuildingAdvancedSenderAccountID]: (draftState, action) => {
    return {
      ...state,
      buildingAdvanced: state.buildingAdvanced.set('senderAccountID', action.payload.senderAccountID),
    }
  },
  [WalletsGen.setBuildingAdvancedSenderAsset]: (draftState, action) => {
    return {
      ...state,
      buildingAdvanced: state.buildingAdvanced.set('senderAsset', action.payload.senderAsset),
      builtPaymentAdvanced: Constants.emptyBuiltPaymentAdvanced,
    }
  },
  [WalletsGen.setBuildingAdvancedSecretNote]: (draftState, action) => {
    return {
      ...state,
      buildingAdvanced: state.buildingAdvanced.set('secretNote', action.payload.secretNote),
      // TODO PICNIC-142 clear error when we have that
    }
  },
  [WalletsGen.sendAssetChoicesReceived]: (draftState, action) => {
    const {sendAssetChoices} = action.payload
    return {...state, building: state.building.merge({sendAssetChoices})}
  },
  [WalletsGen.buildingPaymentIDReceived]: (draftState, action) => {
    const {bid} = action.payload
    return {...state, building: state.building.merge({bid})}
  },
  [WalletsGen.setLastSentXLM]: (draftState, action) => {
    return {...state, lastSentXLM: action.payload.lastSentXLM}
  },
  [WalletsGen.setReadyToReview]: (draftState, action) => {
    return {...state, builtPayment: state.builtPayment.merge({readyToReview: action.payload.readyToReview})}
  },
  [WalletsGen.validateAccountName]: (draftState, action) => {
    return {...state, accountName: action.payload.name, accountNameValidationState: 'waiting'}
  },
  [WalletsGen.validatedAccountName]: (draftState, action) => {
    if (action.payload.name !== state.accountName) {
      // this wasn't from the most recent call
      return state
    }
    return {
      ...state,
      accountName: '',
      accountNameError: action.payload.error ? action.payload.error : '',
      accountNameValidationState: action.payload.error ? 'error' : 'valid',
    }
  },
  [WalletsGen.validateSecretKey]: (draftState, action) => {
    return {...state, secretKey: action.payload.secretKey, secretKeyValidationState: 'waiting'}
  },
  [WalletsGen.validatedSecretKey]: (draftState, action) => {
    if (action.payload.secretKey.stringValue() !== state.secretKey.stringValue()) {
      // this wasn't from the most recent call
      return state
    }
    return {
      ...state,
      secretKey: new HiddenString(''),
      secretKeyError: action.payload.error ? action.payload.error : '',
      secretKeyValidationState: action.payload.error ? 'error' : 'valid',
    }
  },
  [WalletsGen.changedTrustline]: (draftState, action) => {
    return {...state, changeTrustlineError: action.payload.error || ''}
  },
  [WalletsGen.clearErrors]: (draftState, action) => {
    return {
      ...state,
      accountName: '',
      accountNameError: '',
      accountNameValidationState: 'none',
      builtPayment: state.builtPayment.merge({readyToSend: 'spinning'}),
      changeTrustlineError: '',
      createNewAccountError: '',
      linkExistingAccountError: '',
      secretKey: new HiddenString(''),
      secretKeyError: '',
      secretKeyValidationState: 'none',
      sentPaymentError: '',
    }
  },
  [WalletsGen.createdNewAccount]: (draftState, action) => {
    return action.payload.error
      ? {...state, createNewAccountError: action.payload.error ?? ''}
      : {
          ...state,
          accountName: '',
          accountNameError: '',
          accountNameValidationState: 'none',
          changeTrustlineError: '',
          createNewAccountError: '',
          linkExistingAccountError: '',
          secretKey: new HiddenString(''),
          secretKeyError: '',
          secretKeyValidationState: 'none',
          selectedAccount: action.payload.accountID,
        }
  },
  [WalletsGen.linkedExistingAccount]: (draftState, action) => {
    return action.payload.error
      ? {...state, linkExistingAccountError: action.payload.error ?? ''}
      : {
          ...state,
          accountName: '',
          accountNameError: '',
          accountNameValidationState: 'none',
          createNewAccountError: '',
          linkExistingAccountError: '',
          secretKey: new HiddenString(''),
          secretKeyError: '',
          secretKeyValidationState: 'none',
          selectedAccount: action.payload.accountID,
        }
  },
  [WalletsGen.sentPaymentError]: (draftState, action) => {
    return {...state, sentPaymentError: action.payload.error}
  },
  [WalletsGen.loadMorePayments]: (draftState, action) => {
    return state.paymentCursorMap.get(action.payload.accountID)
      ? {...state, paymentLoadingMoreMap: state.paymentLoadingMoreMap.set(action.payload.accountID, true)}
      : state
  },
  [WalletsGen.badgesUpdated]: (draftState, action) => {
    return {
      ...state,
      unreadPaymentsMap: I.Map(
        action.payload.accounts.map(({accountID, numUnread}) => [accountID, numUnread])
      ),
    }
  },
  [WalletsGen.walletDisclaimerReceived]: (draftState, action) => {
    return {...state, acceptedDisclaimer: action.payload.accepted}
  },
  [WalletsGen.acceptDisclaimer]: (draftState, action) => {
    return {...state, acceptingDisclaimerDelay: true}
  },
  [WalletsGen.resetAcceptingDisclaimer]: (draftState, action) => {
    return {...state, acceptingDisclaimerDelay: false}
  },
  [WalletsGen.loadedMobileOnlyMode]: (draftState, action) => {
    return {
      ...state,
      mobileOnlyMap: state.mobileOnlyMap.set(action.payload.accountID, action.payload.enabled),
    }
  },
  [WalletsGen.updatedAirdropState]: (draftState, action) => {
    return {
      ...state,
      airdropQualifications: I.List(action.payload.airdropQualifications),
      airdropState: action.payload.airdropState,
    }
  },
  [WalletsGen.validateSEP7Link]: (draftState, action) => {
    // Clear out old state just in [
    return {
      ...state,
      sep7ConfirmError: '',
      sep7ConfirmInfo: undefined,
      sep7ConfirmPath: Constants.emptyBuiltPaymentAdvanced,
      sep7ConfirmURI: '',
      sep7SendError: '',
    }
  },
  [WalletsGen.setSEP7SendError]: (draftState, action) => {
    return {...state, sep7SendError: action.payload.error}
  },
  [WalletsGen.validateSEP7LinkError]: (draftState, action) => {
    return {...state, sep7ConfirmError: action.payload.error}
  },
  [WalletsGen.setSEP7Tx]: (draftState, action) => {
    return {...state, sep7ConfirmInfo: action.payload.tx, sep7ConfirmURI: action.payload.confirmURI}
  },
  [WalletsGen.hideAirdropBanner]: (draftState, action) => {
    // set this immediately so it goes away immediately
    return {...state, airdropShowBanner: false}
  },
  [WalletsGen.updateAirdropBannerState]: (draftState, action) => {
    return {...state, airdropShowBanner: action.payload.show}
  },
  [WalletsGen.updatedAirdropDetails]: (draftState, action) => {
    const {details, disclaimer, isPromoted} = action.payload
    return {...state, airdropDetails: Constants.makeStellarDetails({details, disclaimer, isPromoted})}
  },
  [WalletsGen.setTrustlineExpanded]: (draftState, action) => {
    return {
      ...state,
      trustline: state.trustline.update('expandedAssets', expandedAssets =>
        action.payload.expanded
          ? expandedAssets.add(action.payload.assetID)
          : expandedAssets.delete(action.payload.assetID)
      ),
    }
  },
  [WalletsGen.setTrustlineAcceptedAssets]: (draftState, action) => {
    return {
      ...state,
      trustline: state.trustline
        .update('acceptedAssets', acceptedAssets =>
          acceptedAssets.update(action.payload.accountID, accountAcceptedAssets =>
            action.payload.limits.equals(accountAcceptedAssets)
              ? accountAcceptedAssets
              : action.payload.limits
          )
        )
        .update('assetMap', assetMap => reduceAssetMap(assetMap, action.payload.assets)),
    }
  },
  [WalletsGen.setTrustlineAcceptedAssetsByUsername]: (draftState, action) => {
    return {
      ...state,
      trustline: state.trustline
        .update('acceptedAssetsByUsername', acceptedAssetsByUsername =>
          acceptedAssetsByUsername.update(action.payload.username, accountAcceptedAssets =>
            action.payload.limits.equals(accountAcceptedAssets)
              ? accountAcceptedAssets
              : action.payload.limits
          )
        )
        .update('assetMap', assetMap => reduceAssetMap(assetMap, action.payload.assets)),
    }
  },
  [WalletsGen.setTrustlinePopularAssets]: (draftState, action) => {
    return {
      ...state,
      trustline: state.trustline.withMutations(trustline =>
        trustline
          .set(
            'popularAssets',
            I.List(action.payload.assets.map(asset => Types.assetDescriptionToAssetID(asset)))
          )
          .update('assetMap', assetMap => reduceAssetMap(assetMap, action.payload.assets))
          .set('totalAssetsCount', action.payload.totalCount)
          .set('loaded', true)
      ),
    }
  },
  [WalletsGen.setTrustlineSearchText]: (draftState, action) => {
    return action.payload.text
      ? state
      : {...state, trustline: state.trustline.set('searchingAssets', I.List())}
  },
  [WalletsGen.setTrustlineSearchResults]: (draftState, action) => {
    return {
      ...state,
      trustline: state.trustline
        .set(
          'searchingAssets',
          I.List(action.payload.assets.map(asset => Types.assetDescriptionToAssetID(asset)))
        )
        .update('assetMap', assetMap => reduceAssetMap(assetMap, action.payload.assets)),
    }
  },
  [WalletsGen.clearTrustlineSearchResults]: (draftState, action) => {
    return {...state, trustline: state.trustline.set('searchingAssets', undefined)}
  },
  [WalletsGen.setBuiltPaymentAdvanced]: (draftState, action) => {
    return action.payload.forSEP7
      ? {...state, sep7ConfirmPath: action.payload.builtPaymentAdvanced}
      : {...state, builtPaymentAdvanced: action.payload.builtPaymentAdvanced}
  },
  [WalletsGen.staticConfigLoaded]: (draftState, action) => {
    return {...state, staticConfig: action.payload.staticConfig}
  },
  [WalletsGen.assetDeposit]: (draftState, action) => {
    // fall
  },
  [WalletsGen.assetWithdraw]: (draftState, action) => {
    return {...state, sep6Error: false, sep6Message: ''}
  },
  [WalletsGen.setSEP6Message]: (draftState, action) => {
    return {...state, sep6Error: action.payload.error, sep6Message: action.payload.message}
  },
  ...teamBuilderReducerCreator<Actions, Types.State>(
    (draftState: Container.Draft<Types.State>, action: TeamBuildingGen.Actions) => {
      draftState.teamBuilding = teamBuildingReducer(
        'wallets',
        draftState.teamBuilding as Types.State['teamBuilding'],
        action
      )
    }
  ),
})

if (__DEV__) {
  console.log(new Array(100).fill('wallets reducer double check').join('\n'))
}

const doubleCheck = (
  state: Types.State = initialState,
  action: WalletsGen.Actions | TeamBuildingGen.Actions
): Types.State => {
  const nextState = newReducer(state, action)

  if (__DEV__) {
    const s = ConstantsOLD.makeState(state)
    const nextStateOLD = reducerOLD(s, action)
    const o: any = {
      ...nextStateOLD.toJS(),
      reviewLastSeqno: nextStateOLD.reviewLastSeqno || null,
      sep7ConfirmInfo: nextStateOLD.sep7ConfirmInfo || null,
      staticConfig: nextStateOLD.staticConfig || null,
    }

    const n: any = {
      ...nextState,
      reviewLastSeqno: nextState.reviewLastSeqno || null,
      sep7ConfirmInfo: nextState.sep7ConfirmInfo || null,
      staticConfig: nextState.staticConfig || null,
    }

    let same = true
    Object.keys(o).forEach(k => {
      const so = JSON.stringify(o[k])
      const sn = JSON.stringify(n[k])
      if (so !== sn) {
        same = false
        console.log('aaa diff', k, so, sn)
      }
    })
    if (same) {
      console.log('aaa same')
    }
  }

  return nextState
}

export default doubleCheck
