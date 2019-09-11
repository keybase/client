import logger from '../logger'
import * as I from 'immutable'
import * as Constants from '../constants/wallets'
import * as Types from '../constants/types/wallets'
import * as WalletsGen from '../actions/wallets-gen'
import {actionHasError} from '../util/container'
import HiddenString from '../util/hidden-string'

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

export default function(state: Types.State = initialState, action: WalletsGen.Actions): Types.State {
  switch (action.type) {
    case WalletsGen.resetStore:
      return initialState.merge({
        staticConfig: state.staticConfig,
      })
    case WalletsGen.didSetAccountAsDefault:
    case WalletsGen.accountsReceived: {
      const accountMap: I.OrderedMap<Types.AccountID, Types.Account> = I.OrderedMap(
        action.payload.accounts.map(account => [account.accountID, account])
      )
      return state.merge({accountMap: accountMap})
    }
    case WalletsGen.changedAccountName:
    case WalletsGen.accountUpdateReceived:
      // accept the updated account if we've loaded it already
      // this is because we get the sort order from the full accounts load,
      // and can't figure it out from these notifications alone.
      if (state.accountMap.get(action.payload.account.accountID)) {
        return state.update('accountMap', am =>
          am.update(action.payload.account.accountID, acc => acc.merge(action.payload.account))
        )
      }
      return state
    case WalletsGen.assetsReceived:
      return state.setIn(['assetsMap', action.payload.accountID], I.List(action.payload.assets))
    case WalletsGen.buildPayment:
      return state.set('buildCounter', state.buildCounter + 1)
    case WalletsGen.builtPaymentReceived:
      return action.payload.forBuildCounter === state.buildCounter
        ? state.merge({
            builtPayment: state.builtPayment.merge(Constants.makeBuiltPayment(action.payload.build)),
          })
        : state
    case WalletsGen.builtRequestReceived:
      return action.payload.forBuildCounter === state.buildCounter
        ? state.merge({
            builtRequest: state.builtRequest.merge(Constants.makeBuiltRequest(action.payload.build)),
          })
        : state
    case WalletsGen.openSendRequestForm: {
      if (!state.acceptedDisclaimer) {
        return state
      }
      const initialBuilding = Constants.makeBuilding()
      return state.merge({
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
      })
    }
    case WalletsGen.abandonPayment:
    case WalletsGen.clearBuilding:
      return state.merge({building: Constants.makeBuilding()})
    case WalletsGen.clearBuiltPayment:
      return state.merge({builtPayment: Constants.makeBuiltPayment()})
    case WalletsGen.clearBuiltRequest:
      return state.merge({builtRequest: Constants.makeBuiltRequest()})
    case WalletsGen.externalPartnersReceived:
      return state.merge({externalPartners: action.payload.externalPartners})
    case WalletsGen.paymentDetailReceived:
      return state.updateIn(['paymentsMap', action.payload.accountID], (paymentsMap = I.Map()) =>
        Constants.updatePaymentDetail(paymentsMap, action.payload.payment)
      )
    case WalletsGen.paymentsReceived: {
      let newState = state
        .updateIn(['paymentsMap', action.payload.accountID], (paymentsMap = I.Map()) =>
          Constants.updatePaymentsReceived(paymentsMap, [
            ...action.payload.payments,
            ...action.payload.pending,
          ])
        )
        .setIn(['paymentCursorMap', action.payload.accountID], action.payload.paymentCursor)
        .setIn(['paymentLoadingMoreMap', action.payload.accountID], false)
      // allowClearOldestUnread dictates whether this action is allowed to delete the value of oldestUnread.
      // GetPaymentsLocal can erroneously return an empty oldestUnread value when a non-latest page is requested
      // and oldestUnread points into the latest page.
      if (
        action.payload.allowClearOldestUnread ||
        (action.payload.oldestUnread || Types.noPaymentID) !== Types.noPaymentID
      ) {
        newState = newState.setIn(
          ['paymentOldestUnreadMap', action.payload.accountID],
          action.payload.oldestUnread
        )
      }
      return newState
    }
    case WalletsGen.pendingPaymentsReceived: {
      const newPending = I.Map(action.payload.pending.map(p => [p.id, Constants.makePayment().merge(p)]))
      return state.updateIn(['paymentsMap', action.payload.accountID], (paymentsMap = I.Map()) =>
        paymentsMap.filter((p: any) => p.section !== 'pending').merge(newPending)
      )
    }
    case WalletsGen.recentPaymentsReceived: {
      const newPayments = I.Map(action.payload.payments.map(p => [p.id, Constants.makePayment().merge(p)]))
      return state
        .updateIn(['paymentsMap', action.payload.accountID], (paymentsMap = I.Map()) =>
          paymentsMap.merge(newPayments)
        )
        .updateIn(
          ['paymentCursorMap', action.payload.accountID],
          cursor => cursor || action.payload.paymentCursor
        )
        .setIn(['paymentOldestUnreadMap', action.payload.accountID], action.payload.oldestUnread)
    }
    case WalletsGen.displayCurrenciesReceived:
      return state.merge({currencies: I.List(action.payload.currencies)})
    case WalletsGen.displayCurrencyReceived: {
      const account = Constants.getAccountInner(state, action.payload.accountID || Types.noAccountID)
      if (account.accountID === Types.noAccountID) {
        return state
      }
      return state.merge({
        accountMap: state.accountMap.set(
          account.accountID,
          account.merge({displayCurrency: action.payload.currency})
        ),
      })
    }
    case WalletsGen.reviewPayment:
      return state
        .setIn(['builtPayment', 'reviewBanners'], [])
        .set('reviewCounter', state.reviewCounter + 1)
        .set('reviewLastSeqno', null)
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
      return state.merge({
        builtPayment: state.builtPayment.merge({
          readyToSend: nextButton,
          reviewBanners: banners,
        }),
        reviewLastSeqno: seqno,
      })
    }
    case WalletsGen.secretKeyReceived:
      return state.merge({
        exportedSecretKey: action.payload.secretKey,
        exportedSecretKeyAccountID: state.get('selectedAccount'),
      })
    case WalletsGen.secretKeySeen:
      return state.merge({
        exportedSecretKey: new HiddenString(''),
        exportedSecretKeyAccountID: Types.noAccountID,
      })
    case WalletsGen.selectAccount: {
      if (!action.payload.accountID) {
        logger.error('Selecting empty account ID')
      }
      const newState = state.merge({
        exportedSecretKey: new HiddenString(''),
        selectedAccount: action.payload.accountID,
      })
      // we clear the old selected payments and cursors
      if (!state.selectedAccount) {
        return newState
      }

      return newState
        .deleteIn(['paymentCursorMap', state.selectedAccount])
        .deleteIn(['paymentsMap', state.selectedAccount])
    }
    case WalletsGen.setBuildingAmount: {
      const {amount} = action.payload
      return state.merge({
        building: state.get('building').merge({amount}),
        builtPayment: state
          .get('builtPayment')
          .merge({amountErrMsg: '', worthDescription: '', worthInfo: ''}),
        builtRequest: state
          .get('builtRequest')
          .merge({amountErrMsg: '', worthDescription: '', worthInfo: ''}),
      })
    }
    case WalletsGen.setBuildingCurrency: {
      const {currency} = action.payload
      return state.merge({
        building: state.get('building').merge({currency}),
        builtPayment: Constants.makeBuiltPayment(),
      })
    }
    case WalletsGen.setBuildingFrom: {
      const {from} = action.payload
      return state.merge({
        building: state.get('building').merge({from}),
        builtPayment: Constants.makeBuiltPayment(),
      })
    }
    case WalletsGen.setBuildingIsRequest: {
      const {isRequest} = action.payload
      return state.merge({
        building: state.get('building').merge({isRequest}),
        builtPayment: Constants.makeBuiltPayment(),
        builtRequest: Constants.makeBuiltRequest(),
      })
    }
    case WalletsGen.setBuildingPublicMemo: {
      const {publicMemo} = action.payload
      return state.merge({
        building: state.get('building').merge({publicMemo}),
        builtPayment: state.get('builtPayment').merge({publicMemoErrMsg: new HiddenString('')}),
      })
    }
    case WalletsGen.setBuildingRecipientType: {
      const {recipientType} = action.payload
      return state.merge({
        building: state.get('building').merge({recipientType}),
        builtPayment: Constants.makeBuiltPayment(),
      })
    }
    case WalletsGen.setBuildingSecretNote: {
      const {secretNote} = action.payload
      return state.merge({
        building: state.get('building').merge({secretNote}),
        builtPayment: state.get('builtPayment').merge({secretNoteErrMsg: new HiddenString('')}),
        builtRequest: state.get('builtRequest').merge({secretNoteErrMsg: new HiddenString('')}),
      })
    }
    case WalletsGen.setBuildingTo: {
      const {to} = action.payload
      return state.merge({
        building: state.get('building').merge({to}),
        builtPayment: state.get('builtPayment').merge({toErrMsg: ''}),
        builtRequest: state.get('builtRequest').merge({toErrMsg: ''}),
      })
    }
    case WalletsGen.clearBuildingAdvanced:
      return state
        .set('buildingAdvanced', Constants.emptyBuildingAdvanced)
        .set('builtPaymentAdvanced', Constants.emptyBuiltPaymentAdvanced)
    case WalletsGen.setBuildingAdvancedRecipient:
      return state.update('buildingAdvanced', buildingAdvanced =>
        buildingAdvanced.set('recipient', action.payload.recipient)
      )
    case WalletsGen.setBuildingAdvancedRecipientAmount:
      return state
        .update('buildingAdvanced', buildingAdvanced =>
          buildingAdvanced.set('recipientAmount', action.payload.recipientAmount)
        )
        .set('builtPaymentAdvanced', Constants.emptyBuiltPaymentAdvanced)
    case WalletsGen.setBuildingAdvancedRecipientAsset:
      return state
        .update('buildingAdvanced', buildingAdvanced =>
          buildingAdvanced.set('recipientAsset', action.payload.recipientAsset)
        )
        .set('builtPaymentAdvanced', Constants.emptyBuiltPaymentAdvanced)
    case WalletsGen.setBuildingAdvancedRecipientType:
      return state.update('buildingAdvanced', buildingAdvanced =>
        buildingAdvanced.set('recipientType', action.payload.recipientType)
      )
    case WalletsGen.setBuildingAdvancedPublicMemo:
      return state.update(
        'buildingAdvanced',
        buildingAdvanced => buildingAdvanced.set('publicMemo', action.payload.publicMemo)
        // TODO PICNIC-142 clear error when we have that
      )
    case WalletsGen.setBuildingAdvancedSenderAccountID:
      return state.update('buildingAdvanced', buildingAdvanced =>
        buildingAdvanced.set('senderAccountID', action.payload.senderAccountID)
      )
    case WalletsGen.setBuildingAdvancedSenderAsset:
      return state
        .update('buildingAdvanced', buildingAdvanced =>
          buildingAdvanced.set('senderAsset', action.payload.senderAsset)
        )
        .set('builtPaymentAdvanced', Constants.emptyBuiltPaymentAdvanced)
    case WalletsGen.setBuildingAdvancedSecretNote:
      return state.update(
        'buildingAdvanced',
        buildingAdvanced => buildingAdvanced.set('secretNote', action.payload.secretNote)
        // TODO PICNIC-142 clear error when we have that
      )
    case WalletsGen.sendAssetChoicesReceived: {
      const {sendAssetChoices} = action.payload
      return state.merge({
        building: state.get('building').merge({sendAssetChoices}),
        builtPayment: Constants.makeBuiltPayment(),
      })
    }
    case WalletsGen.buildingPaymentIDReceived: {
      const {bid} = action.payload
      return state.merge({
        building: state.get('building').merge({bid}),
      })
    }
    case WalletsGen.setLastSentXLM:
      return state.merge({lastSentXLM: action.payload.lastSentXLM})
    case WalletsGen.setReadyToReview:
      return state.set(
        'builtPayment',
        state.get('builtPayment').merge({readyToReview: action.payload.readyToReview})
      )
    case WalletsGen.validateAccountName:
      return state.merge({
        accountName: action.payload.name,
        accountNameValidationState: 'waiting',
      })
    case WalletsGen.validatedAccountName:
      if (action.payload.name !== state.accountName) {
        // this wasn't from the most recent call
        return state
      }
      return state.merge({
        accountName: '',
        accountNameError: actionHasError(action) ? action.payload.error : '',
        accountNameValidationState: actionHasError(action) ? 'error' : 'valid',
      })
    case WalletsGen.validateSecretKey:
      return state.merge({
        secretKey: action.payload.secretKey,
        secretKeyValidationState: 'waiting',
      })
    case WalletsGen.validatedSecretKey:
      if (action.payload.secretKey.stringValue() !== state.secretKey.stringValue()) {
        // this wasn't from the most recent call
        return state
      }
      return state.merge({
        secretKey: new HiddenString(''),
        secretKeyError: actionHasError(action) ? action.payload.error : '',
        secretKeyValidationState: actionHasError(action) ? 'error' : 'valid',
      })
    case WalletsGen.changedTrustline:
      return actionHasError(action)
        ? state.merge({changeTrustlineError: action.payload.error})
        : state.merge({changeTrustlineError: ''})
    case WalletsGen.clearErrors:
      return state.merge({
        accountName: '',
        accountNameError: '',
        accountNameValidationState: 'none',
        builtPayment: state.get('builtPayment').merge({readyToSend: 'spinning'}),
        changeTrustlineError: '',
        createNewAccountError: '',
        linkExistingAccountError: '',
        secretKey: new HiddenString(''),
        secretKeyError: '',
        secretKeyValidationState: 'none',
        sentPaymentError: '',
      })
    case WalletsGen.createdNewAccount:
      return actionHasError(action)
        ? state.merge({createNewAccountError: action.payload.error})
        : state.merge({
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
          })
    case WalletsGen.linkedExistingAccount:
      return actionHasError(action)
        ? state.merge({linkExistingAccountError: action.payload.error})
        : state.merge({
            accountName: '',
            accountNameError: '',
            accountNameValidationState: 'none',
            createNewAccountError: '',
            linkExistingAccountError: '',
            secretKey: new HiddenString(''),
            secretKeyError: '',
            secretKeyValidationState: 'none',
            selectedAccount: action.payload.accountID,
          })
    case WalletsGen.sentPaymentError:
      return state.merge({sentPaymentError: action.payload.error})
    case WalletsGen.loadMorePayments:
      return state.paymentCursorMap.get(action.payload.accountID)
        ? state.setIn(['paymentLoadingMoreMap', action.payload.accountID], true)
        : state
    case WalletsGen.badgesUpdated:
      return state.merge({
        unreadPaymentsMap: I.Map(
          action.payload.accounts.map(({accountID, numUnread}) => [accountID, numUnread])
        ),
      })
    case WalletsGen.walletDisclaimerReceived:
      return state.merge({acceptedDisclaimer: action.payload.accepted})
    case WalletsGen.acceptDisclaimer:
      return state.merge({
        acceptingDisclaimerDelay: true,
      })
    case WalletsGen.resetAcceptingDisclaimer:
      return state.merge({
        acceptingDisclaimerDelay: false,
      })
    case WalletsGen.loadedMobileOnlyMode:
      return state.setIn(['mobileOnlyMap', action.payload.accountID], action.payload.enabled)
    case WalletsGen.inflationDestinationReceived:
      return actionHasError(action)
        ? state.merge({inflationDestinationError: action.payload.error})
        : state.merge({
            inflationDestinationError: '',
            inflationDestinationMap: state.inflationDestinationMap.merge(
              I.Map([[action.payload.accountID, action.payload.selected]])
            ),
            inflationDestinations: action.payload.options
              ? I.List(action.payload.options)
              : state.inflationDestinations,
          })
    case WalletsGen.setInflationDestination:
      return state.merge({inflationDestinationError: ''})
    case WalletsGen.updatedAirdropState:
      return state.merge({
        airdropQualifications: I.List(action.payload.airdropQualifications),
        airdropState: action.payload.airdropState,
      })
    case WalletsGen.validateSEP7Link:
      // Clear out old state just in case.
      return state.merge({
        sep7ConfirmError: '',
        sep7ConfirmInfo: null,
        sep7ConfirmPath: Constants.emptyBuiltPaymentAdvanced,
        sep7ConfirmURI: '',
      })
    case WalletsGen.validateSEP7LinkError:
      return state.merge({sep7ConfirmError: action.payload.error})
    case WalletsGen.setSEP7Tx:
      return state.merge({sep7ConfirmInfo: action.payload.tx, sep7ConfirmURI: action.payload.confirmURI})
    case WalletsGen.hideAirdropBanner:
      // set this immediately so it goes away immediately
      return state.merge({airdropShowBanner: false})
    case WalletsGen.updateAirdropBannerState:
      return state.merge({airdropShowBanner: action.payload.show})
    case WalletsGen.updatedAirdropDetails: {
      const {details, disclaimer, isPromoted} = action.payload
      return state.set('airdropDetails', Constants.makeStellarDetails({details, disclaimer, isPromoted}))
    }
    case WalletsGen.setTrustlineExpanded:
      return state.update('trustline', trustline =>
        trustline.update('expandedAssets', expandedAssets =>
          action.payload.expanded
            ? expandedAssets.add(action.payload.assetID)
            : expandedAssets.delete(action.payload.assetID)
        )
      )
    case WalletsGen.setTrustlineAcceptedAssets:
      return state.update('trustline', trustline =>
        trustline
          .update('acceptedAssets', acceptedAssets =>
            acceptedAssets.update(action.payload.accountID, accountAcceptedAssets =>
              action.payload.limits.equals(accountAcceptedAssets)
                ? accountAcceptedAssets
                : action.payload.limits
            )
          )
          .update('assetMap', assetMap => reduceAssetMap(assetMap, action.payload.assets))
      )
    case WalletsGen.setTrustlineAcceptedAssetsByUsername:
      return state.update('trustline', trustline =>
        trustline
          .update('acceptedAssetsByUsername', acceptedAssetsByUsername =>
            acceptedAssetsByUsername.update(action.payload.username, accountAcceptedAssets =>
              action.payload.limits.equals(accountAcceptedAssets)
                ? accountAcceptedAssets
                : action.payload.limits
            )
          )
          .update('assetMap', assetMap => reduceAssetMap(assetMap, action.payload.assets))
      )
    case WalletsGen.setTrustlinePopularAssets:
      return state.update('trustline', trustline =>
        trustline.withMutations(trustline =>
          trustline
            .set(
              'popularAssets',
              I.List(action.payload.assets.map(asset => Types.assetDescriptionToAssetID(asset)))
            )
            .update('assetMap', assetMap => reduceAssetMap(assetMap, action.payload.assets))
            .set('totalAssetsCount', action.payload.totalCount)
            .set('loaded', true)
        )
      )
    case WalletsGen.setTrustlineSearchText:
      return action.payload.text
        ? state
        : state.update('trustline', trustline => trustline.set('searchingAssets', I.List()))
    case WalletsGen.setTrustlineSearchResults:
      return state.update('trustline', trustline =>
        trustline
          .set(
            'searchingAssets',
            I.List(action.payload.assets.map(asset => Types.assetDescriptionToAssetID(asset)))
          )
          .update('assetMap', assetMap => reduceAssetMap(assetMap, action.payload.assets))
      )
    case WalletsGen.clearTrustlineSearchResults:
      return state.update('trustline', trustline => trustline.set('searchingAssets', undefined))
    case WalletsGen.setBuiltPaymentAdvanced:
      return action.payload.forSEP7
        ? state.set('sep7ConfirmPath', action.payload.builtPaymentAdvanced)
        : state.set('builtPaymentAdvanced', action.payload.builtPaymentAdvanced)
    case WalletsGen.staticConfigLoaded:
      return state.set('staticConfig', action.payload.staticConfig)
    case WalletsGen.assetDeposit:
    case WalletsGen.assetWithdraw:
      return state.merge({
        sep6Error: false,
        sep6Message: '',
      })
    case WalletsGen.setSEP6Message:
      return state.merge({
        sep6Error: action.payload.error,
        sep6Message: action.payload.message,
      })
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
    case WalletsGen.loadInflationDestination:
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
