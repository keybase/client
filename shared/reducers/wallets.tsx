import logger from '../logger'
import * as TeamBuildingGen from '../actions/team-building-gen'
import * as I from 'immutable'
import * as Constants from '../constants/wallets'
import * as Types from '../constants/types/wallets'
import * as WalletsGen from '../actions/wallets-gen'
import HiddenString from '../util/hidden-string'
import teamBuildingReducer from './team-building'

import reducerOLD from './wallets-old'
import * as ConstantsOLD from '../constants/wallets-old'
import * as TypesOLD from '../constants/types/wallets-old'


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

const newReducer = (
  state: Types.State = initialState,
  action: WalletsGen.Actions | TeamBuildingGen.Actions
): Types.State => {
  switch (action.type) {
    case WalletsGen.resetStore:
      return {...initialState, staticConfig: state.staticConfig}
    case WalletsGen.didSetAccountAsDefault:
    case WalletsGen.accountsReceived: {
      const accountMap: I.OrderedMap<Types.AccountID, Types.Account> = I.OrderedMap(
        action.payload.accounts.map(account => [account.accountID, account])
      )
      return {...state, accountMap: accountMap}
    }
    case WalletsGen.changedAccountName:
    case WalletsGen.accountUpdateReceived: {
      const {account} = action.payload
      // accept the updated account if we've loaded it already
      // this is because we get the sort order from the full accounts load,
      // and can't figure it out from these notifications alone.
      if (account && state.accountMap.get(account.accountID)) {
        return {...state, accountMap: state.accountMap.update(account.accountID, acc => acc.merge(account))}
      }
      return state
    }
    case WalletsGen.assetsReceived: {
      const assetsMap = state.assetsMap.set(action.payload.accountID, I.List(action.payload.assets))
      return {...state, assetsMap}
    }
    case WalletsGen.buildPayment:
      return {...state, buildCounter: state.buildCounter + 1}
    case WalletsGen.builtPaymentReceived:
      return action.payload.forBuildCounter === state.buildCounter
        ? {...state, builtPayment: state.builtPayment.merge(Constants.makeBuiltPayment(action.payload.build))}
        : state
    case WalletsGen.builtRequestReceived:
      return action.payload.forBuildCounter === state.buildCounter
        ? {...state, builtRequest: state.builtRequest.merge(Constants.makeBuiltRequest(action.payload.build))}
        : state
    case WalletsGen.openSendRequestForm: {
      if (!state.acceptedDisclaimer) {
        return state
      }
      const initialBuilding = Constants.makeBuilding()
      return {
        ...state,
        building: initialBuilding.merge({
          amount: action.payload.amount || '',
          currency:
            action.payload.currency || // explicitly set
            (state.lastSentXLM && 'XLM') || // lastSentXLM override
            (action.payload.from && Constants.getDisplayCurrencyInner(state, action.payload.from).code) || // display currency of explicitly set 'from' account
            Constants.getDefaultDisplayCurrencyInner(state).code || // display currency of default account
            '', // Empty string -> not loaded
          from: action.payload.from || Types.noAccountID,
          isRequest: !!action.payload.isRequest,
          publicMemo: action.payload.publicMemo || new HiddenString(''),
          recipientType: action.payload.recipientType || 'keybaseUser',
          secretNote: action.payload.secretNote || new HiddenString(''),
          to: action.payload.to || '',
        }),
        builtPayment: Constants.makeBuiltPayment(),
        builtRequest: Constants.makeBuiltRequest(),
        sentPaymentError: '',
      }
    }
    case WalletsGen.abandonPayment:
    case WalletsGen.clearBuilding:
      return {...state, building: Constants.makeBuilding()}
    case WalletsGen.clearBuiltPayment:
      return {...state, builtPayment: Constants.makeBuiltPayment()}
    case WalletsGen.clearBuiltRequest:
      return {...state, builtRequest: Constants.makeBuiltRequest()}
    case WalletsGen.externalPartnersReceived:
      return {...state, externalPartners: action.payload.externalPartners}
    case WalletsGen.paymentDetailReceived: {
      const paymentsMap = state.paymentsMap.update(action.payload.accountID, (paymentsMap = I.Map()) =>
        Constants.updatePaymentDetail(paymentsMap, action.payload.payment)
      )
      return {
        ...state,
        paymentsMap,
      }
    }
    case WalletsGen.paymentsReceived: {
      let newState = {...state}
      newState.paymentsMap = state.paymentsMap.update(action.payload.accountID, (paymentsMap = I.Map()) =>
        Constants.updatePaymentsReceived(paymentsMap, [...action.payload.payments, ...action.payload.pending])
      )
      newState.paymentCursorMap = state.paymentCursorMap.set(
        action.payload.accountID,
        action.payload.paymentCursor
      )
      newState.paymentLoadingMoreMap = state.paymentLoadingMoreMap.set(action.payload.accountID, false)
      // allowClearOldestUnread dictates whether this action is allowed to delete the value of oldestUnread.
      // GetPaymentsLocal can erroneously return an empty oldestUnread value when a non-latest page is requested
      // and oldestUnread points into the latest page.
      if (
        action.payload.allowClearOldestUnread ||
        (action.payload.oldestUnread || Types.noPaymentID) !== Types.noPaymentID
      ) {
        newState.paymentOldestUnreadMap = state.paymentOldestUnreadMap.set(
          action.payload.accountID,
          action.payload.oldestUnread
        )
      }
      return newState
    }
    case WalletsGen.pendingPaymentsReceived: {
      const newPending = I.Map(action.payload.pending.map(p => [p.id, Constants.makePayment().merge(p)]))
      return {
        ...state,
        paymentsMap: state.paymentsMap.update(action.payload.accountID, (paymentsMap = I.Map()) =>
          paymentsMap.filter((p: any) => p.section !== 'pending').merge(newPending)
        ),
      }
    }
    case WalletsGen.recentPaymentsReceived: {
      const newPayments = I.Map(action.payload.payments.map(p => [p.id, Constants.makePayment().merge(p)]))
      return {
        ...state,
        paymentsMap: state.paymentsMap.update(action.payload.accountID, (paymentsMap = I.Map()) =>
          paymentsMap.merge(newPayments)
        ),
        paymentCursorMap: state.paymentCursorMap.update(
          action.payload.accountID,
          cursor => cursor || action.payload.paymentCursor
        ),
        paymentOldestUnreadMap: state.paymentOldestUnreadMap.set(
          action.payload.accountID,
          action.payload.oldestUnread
        ),
      }
    }
    case WalletsGen.displayCurrenciesReceived:
      return {...state, currencies: I.List(action.payload.currencies)}
    case WalletsGen.displayCurrencyReceived: {
      const account = Constants.getAccountInner(state, action.payload.accountID || Types.noAccountID)
      if (account.accountID === Types.noAccountID) {
        return state
      }
      return {
        ...state,
        accountMap: state.accountMap.set(
          account.accountID,
          account.merge({displayCurrency: action.payload.currency})
        ),
      }
    }
    case WalletsGen.reviewPayment:
      return {
        ...state,
        builtPayment: state.builtPayment.set('reviewBanners', []),
        reviewCounter: state.reviewCounter + 1,
        reviewLastSeqno: undefined,
      }
    case WalletsGen.reviewedPaymentReceived: {
      // paymentReviewed notifications can arrive out of order, so check their freshness.
      const {bid, reviewID, seqno, banners, nextButton} = action.payload
      const useable =
        state.building.bid === bid &&
        state.reviewCounter === reviewID &&
        (state.reviewLastSeqno || 0) <= seqno
      if (!useable) {
        logger.info(`ignored stale reviewPaymentReceived`)
        return state
      }
      return {
        ...state,
        builtPayment: state.builtPayment.merge({
          readyToSend: nextButton,
          reviewBanners: banners,
        }),
        reviewLastSeqno: seqno,
      }
    }
    case WalletsGen.secretKeyReceived:
      return {
        ...state,
        exportedSecretKey: action.payload.secretKey,
        exportedSecretKeyAccountID: state.selectedAccount,
      }
    case WalletsGen.secretKeySeen:
      return {
        ...state,
        exportedSecretKey: new HiddenString(''),
        exportedSecretKeyAccountID: Types.noAccountID,
      }
    case WalletsGen.selectAccount: {
      if (!action.payload.accountID) {
        logger.error('Selecting empty account ID')
      }
      const newState = {
        ...state,
        exportedSecretKey: new HiddenString(''),
        selectedAccount: action.payload.accountID,
      }
      // we clear the old selected payments and cursors
      if (!state.selectedAccount) {
        return newState
      }

      newState.paymentCursorMap = newState.paymentCursorMap.delete(state.selectedAccount)
      newState.paymentsMap = newState.paymentsMap.delete(state.selectedAccount)
      return newState
    }
    case WalletsGen.setBuildingAmount: {
      const {amount} = action.payload
      return {
        ...state,
        building: state.building.merge({amount}),
        builtPayment: state.builtPayment.merge({amountErrMsg: '', worthDescription: '', worthInfo: ''}),
        builtRequest: state.builtRequest.merge({amountErrMsg: '', worthDescription: '', worthInfo: ''}),
      }
    }
    case WalletsGen.setBuildingCurrency: {
      const {currency} = action.payload
      return {
        ...state,
        building: state.building.merge({currency}),
        builtPayment: Constants.makeBuiltPayment(),
      }
    }
    case WalletsGen.setBuildingFrom: {
      const {from} = action.payload
      return {...state, building: state.building.merge({from}), builtPayment: Constants.makeBuiltPayment()}
    }
    case WalletsGen.setBuildingIsRequest: {
      const {isRequest} = action.payload
      return {
        ...state,
        building: state.building.merge({isRequest}),
        builtPayment: Constants.makeBuiltPayment(),
        builtRequest: Constants.makeBuiltRequest(),
      }
    }
    case WalletsGen.setBuildingPublicMemo: {
      const {publicMemo} = action.payload
      return {
        ...state,
        building: state.building.merge({publicMemo}),
        builtPayment: state.builtPayment.merge({publicMemoErrMsg: new HiddenString('')}),
      }
    }
    case WalletsGen.setBuildingRecipientType: {
      const {recipientType} = action.payload
      return {
        ...state,
        building: state.building.merge({recipientType}),
        builtPayment: Constants.makeBuiltPayment(),
      }
    }
    case WalletsGen.setBuildingSecretNote: {
      const {secretNote} = action.payload
      return {
        ...state,
        building: state.building.merge({secretNote}),
        builtPayment: state.builtPayment.merge({secretNoteErrMsg: new HiddenString('')}),
        builtRequest: state.builtRequest.merge({secretNoteErrMsg: new HiddenString('')}),
      }
    }
    case WalletsGen.setBuildingTo: {
      const {to} = action.payload
      return {
        ...state,
        building: state.building.merge({to}),
        builtPayment: state.builtPayment.merge({toErrMsg: ''}),
        builtRequest: state.builtRequest.merge({toErrMsg: ''}),
      }
    }
    case WalletsGen.clearBuildingAdvanced:
      return {
        ...state,
        buildingAdvanced: Constants.emptyBuildingAdvanced,
        builtPaymentAdvanced: Constants.emptyBuiltPaymentAdvanced,
      }
    case WalletsGen.setBuildingAdvancedRecipient:
      return {...state, buildingAdvanced: state.buildingAdvanced.set('recipient', action.payload.recipient)}
    case WalletsGen.setBuildingAdvancedRecipientAmount:
      return {
        ...state,
        buildingAdvanced: state.buildingAdvanced.set('recipientAmount', action.payload.recipientAmount),
        builtPaymentAdvanced: Constants.emptyBuiltPaymentAdvanced,
      }
    case WalletsGen.setBuildingAdvancedRecipientAsset:
      return {
        ...state,
        buildingAdvanced: state.buildingAdvanced.set('recipientAsset', action.payload.recipientAsset),
        builtPaymentAdvanced: Constants.emptyBuiltPaymentAdvanced,
      }
    case WalletsGen.setBuildingAdvancedRecipientType:
      return {
        ...state,
        buildingAdvanced: state.buildingAdvanced.set('recipientType', action.payload.recipientType),
      }
    case WalletsGen.setBuildingAdvancedPublicMemo:
      return {
        ...state,
        buildingAdvanced: state.buildingAdvanced.set('publicMemo', action.payload.publicMemo),
        // TODO PICNIC-142 clear error when we have that
      }
    case WalletsGen.setBuildingAdvancedSenderAccountID:
      return {
        ...state,
        buildingAdvanced: state.buildingAdvanced.set('senderAccountID', action.payload.senderAccountID),
      }
    case WalletsGen.setBuildingAdvancedSenderAsset:
      return {
        ...state,
        buildingAdvanced: state.buildingAdvanced.set('senderAsset', action.payload.senderAsset),
        builtPaymentAdvanced: Constants.emptyBuiltPaymentAdvanced,
      }
    case WalletsGen.setBuildingAdvancedSecretNote:
      return {
        ...state,
        buildingAdvanced: state.buildingAdvanced.set('secretNote', action.payload.secretNote),
        // TODO PICNIC-142 clear error when we have that
      }
    case WalletsGen.sendAssetChoicesReceived: {
      const {sendAssetChoices} = action.payload
      return {...state, building: state.building.merge({sendAssetChoices})}
    }
    case WalletsGen.buildingPaymentIDReceived: {
      const {bid} = action.payload
      return {...state, building: state.building.merge({bid})}
    }
    case WalletsGen.setLastSentXLM:
      return {...state, lastSentXLM: action.payload.lastSentXLM}
    case WalletsGen.setReadyToReview:
      return {...state, builtPayment: state.builtPayment.merge({readyToReview: action.payload.readyToReview})}
    case WalletsGen.validateAccountName:
      return {...state, accountName: action.payload.name, accountNameValidationState: 'waiting'}
    case WalletsGen.validatedAccountName:
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
    case WalletsGen.validateSecretKey:
      return {...state, secretKey: action.payload.secretKey, secretKeyValidationState: 'waiting'}
    case WalletsGen.validatedSecretKey:
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
    case WalletsGen.changedTrustline:
      return {...state, changeTrustlineError: action.payload.error || ''}
    case WalletsGen.clearErrors:
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
    case WalletsGen.createdNewAccount:
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
    case WalletsGen.linkedExistingAccount:
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
    case WalletsGen.sentPaymentError:
      return {...state, sentPaymentError: action.payload.error}
    case WalletsGen.loadMorePayments:
      return state.paymentCursorMap.get(action.payload.accountID)
        ? {...state, paymentLoadingMoreMap: state.paymentLoadingMoreMap.set(action.payload.accountID, true)}
        : state
    case WalletsGen.badgesUpdated:
      return {
        ...state,
        unreadPaymentsMap: I.Map(
          action.payload.accounts.map(({accountID, numUnread}) => [accountID, numUnread])
        ),
      }
    case WalletsGen.walletDisclaimerReceived:
      return {...state, acceptedDisclaimer: action.payload.accepted}
    case WalletsGen.acceptDisclaimer:
      return {...state, acceptingDisclaimerDelay: true}
    case WalletsGen.resetAcceptingDisclaimer:
      return {...state, acceptingDisclaimerDelay: false}
    case WalletsGen.loadedMobileOnlyMode:
      return {
        ...state,
        mobileOnlyMap: state.mobileOnlyMap.set(action.payload.accountID, action.payload.enabled),
      }
    case WalletsGen.updatedAirdropState:
      return {
        ...state,
        airdropQualifications: I.List(action.payload.airdropQualifications),
        airdropState: action.payload.airdropState,
      }
    case WalletsGen.validateSEP7Link:
      // Clear out old state just in case.
      return {
        ...state,
        sep7ConfirmError: '',
        sep7ConfirmInfo: undefined,
        sep7ConfirmPath: Constants.emptyBuiltPaymentAdvanced,
        sep7ConfirmURI: '',
        sep7SendError: '',
      }
    case WalletsGen.setSEP7SendError:
      return {...state, sep7SendError: action.payload.error}
    case WalletsGen.validateSEP7LinkError:
      return {...state, sep7ConfirmError: action.payload.error}
    case WalletsGen.setSEP7Tx:
      return {...state, sep7ConfirmInfo: action.payload.tx, sep7ConfirmURI: action.payload.confirmURI}
    case WalletsGen.hideAirdropBanner:
      // set this immediately so it goes away immediately
      return {...state, airdropShowBanner: false}
    case WalletsGen.updateAirdropBannerState:
      return {...state, airdropShowBanner: action.payload.show}
    case WalletsGen.updatedAirdropDetails: {
      const {details, disclaimer, isPromoted} = action.payload
      return {...state, airdropDetails: Constants.makeStellarDetails({details, disclaimer, isPromoted})}
    }
    case WalletsGen.setTrustlineExpanded:
      return {
        ...state,
        trustline: state.trustline.update('expandedAssets', expandedAssets =>
          action.payload.expanded
            ? expandedAssets.add(action.payload.assetID)
            : expandedAssets.delete(action.payload.assetID)
        ),
      }
    case WalletsGen.setTrustlineAcceptedAssets:
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
    case WalletsGen.setTrustlineAcceptedAssetsByUsername:
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
    case WalletsGen.setTrustlinePopularAssets:
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
    case WalletsGen.setTrustlineSearchText:
      return action.payload.text
        ? state
        : {...state, trustline: state.trustline.set('searchingAssets', I.List())}
    case WalletsGen.setTrustlineSearchResults:
      return {
        ...state,
        trustline: state.trustline
          .set(
            'searchingAssets',
            I.List(action.payload.assets.map(asset => Types.assetDescriptionToAssetID(asset)))
          )
          .update('assetMap', assetMap => reduceAssetMap(assetMap, action.payload.assets)),
      }
    case WalletsGen.clearTrustlineSearchResults:
      return {...state, trustline: state.trustline.set('searchingAssets', undefined)}
    case WalletsGen.setBuiltPaymentAdvanced:
      return action.payload.forSEP7
        ? {...state, sep7ConfirmPath: action.payload.builtPaymentAdvanced}
        : {...state, builtPaymentAdvanced: action.payload.builtPaymentAdvanced}
    case WalletsGen.staticConfigLoaded:
      return {...state, staticConfig: action.payload.staticConfig}
    case WalletsGen.assetDeposit:
    case WalletsGen.assetWithdraw:
      return {...state, sep6Error: false, sep6Message: ''}
    case WalletsGen.setSEP6Message:
      return {...state, sep6Error: action.payload.error, sep6Message: action.payload.message}
    case TeamBuildingGen.resetStore:
    case TeamBuildingGen.cancelTeamBuilding:
    case TeamBuildingGen.addUsersToTeamSoFar:
    case TeamBuildingGen.removeUsersFromTeamSoFar:
    case TeamBuildingGen.searchResultsLoaded:
    case TeamBuildingGen.finishedTeamBuilding:
    case TeamBuildingGen.fetchedUserRecs:
    case TeamBuildingGen.fetchUserRecs:
    case TeamBuildingGen.search:
    case TeamBuildingGen.selectRole:
    case TeamBuildingGen.labelsSeen:
    case TeamBuildingGen.changeSendNotification:
      return {...state, teamBuilding: teamBuildingReducer('wallets', state.teamBuilding, action)}
    // Saga only actions
    case WalletsGen.updateAirdropDetails:
    case WalletsGen.changeAirdrop:
    case WalletsGen.updateAirdropState:
    case WalletsGen.rejectDisclaimer:
    case WalletsGen.cancelPayment:
    case WalletsGen.cancelRequest:
    case WalletsGen.createNewAccount:
    case WalletsGen.exportSecretKey:
    case WalletsGen.linkExistingAccount:
    case WalletsGen.loadAssets:
    case WalletsGen.loadPaymentDetail:
    case WalletsGen.loadPayments:
    case WalletsGen.loadDisplayCurrencies:
    case WalletsGen.markAsRead:
    case WalletsGen.loadDisplayCurrency:
    case WalletsGen.changeDisplayCurrency:
    case WalletsGen.changeAccountName:
    case WalletsGen.checkDisclaimer:
    case WalletsGen.deleteAccount:
    case WalletsGen.deletedAccount:
    case WalletsGen.loadAccounts:
    case WalletsGen.loadWalletDisclaimer:
    case WalletsGen.setAccountAsDefault:
    case WalletsGen.showTransaction:
    case WalletsGen.sendPayment:
    case WalletsGen.sentPayment:
    case WalletsGen.requestPayment:
    case WalletsGen.requestedPayment:
    case WalletsGen.loadSendAssetChoices:
    case WalletsGen.loadMobileOnlyMode:
    case WalletsGen.changeMobileOnlyMode:
    case WalletsGen.exitFailedPayment:
    case WalletsGen.loadExternalPartners:
    case WalletsGen.acceptSEP7Pay:
    case WalletsGen.acceptSEP7Path:
    case WalletsGen.acceptSEP7Tx:
    case WalletsGen.refreshTrustlineAcceptedAssets:
    case WalletsGen.refreshTrustlinePopularAssets:
    case WalletsGen.calculateBuildingAdvanced:
      return state
    default:
      return state
  }
}

if (__DEV__) {
    console.log(new Array(100).fill('wallets reducer double check').join('\n'))
}

const doubleCheck = (
  state: Types.State = initialState,
  action: WalletsGen.Actions | TeamBuildingGen.Actions
): Types.State => {
    const nextState = newReducer(state, action)

    if (__DEV__) {
        // TODO transform
        const s = ConstantsOLD.makeState(state)
        const nextStateOLD   = reducerOLD(s,action)
        // TODO compare
    }

    return nextState
}

export default doubleCheck
