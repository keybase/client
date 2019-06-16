import logger from '../logger'
import * as I from 'immutable'
import * as Constants from '../constants/wallets'
import * as Types from '../constants/types/wallets'
import * as WalletsGen from '../actions/wallets-gen'
import {actionHasError} from '../util/container'
import HiddenString from '../util/hidden-string'

const initialState: Types.State = Constants.makeState()

export default function(state: Types.State = initialState, action: WalletsGen.Actions): Types.State {
  switch (action.type) {
    case WalletsGen.resetStore:
      return initialState
    case WalletsGen.accountsReceived:
      const accountMap: I.OrderedMap<Types.AccountID, Types.Account> = I.OrderedMap(
        action.payload.accounts.map(account => [account.accountID, account])
      )
      return state.merge({accountMap: accountMap})
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
    case WalletsGen.openSendRequestForm:
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
    case WalletsGen.paymentsReceived:
      return state
        .updateIn(['paymentsMap', action.payload.accountID], (paymentsMap = I.Map()) =>
          Constants.updatePaymentsReceived(paymentsMap, [
            ...action.payload.payments,
            ...action.payload.pending,
          ])
        )
        .setIn(['paymentCursorMap', action.payload.accountID], action.payload.paymentCursor)
        .setIn(['paymentLoadingMoreMap', action.payload.accountID], false)
        .setIn(['paymentOldestUnreadMap', action.payload.accountID], action.payload.oldestUnread)
    case WalletsGen.pendingPaymentsReceived:
      const newPending = I.Map(action.payload.pending.map(p => [p.id, Constants.makePayment().merge(p)]))
      return state.updateIn(['paymentsMap', action.payload.accountID], (paymentsMap = I.Map()) =>
        paymentsMap.filter(p => p.section !== 'pending').merge(newPending)
      )
    case WalletsGen.recentPaymentsReceived:
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
    case WalletsGen.setBuildingAmount:
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
    case WalletsGen.setBuildingCurrency:
      const {currency} = action.payload
      return state.merge({
        building: state.get('building').merge({currency}),
        builtPayment: Constants.makeBuiltPayment(),
      })
    case WalletsGen.setBuildingFrom:
      const {from} = action.payload
      return state.merge({
        building: state.get('building').merge({from}),
        builtPayment: Constants.makeBuiltPayment(),
      })
    case WalletsGen.setBuildingIsRequest:
      const {isRequest} = action.payload
      return state.merge({
        building: state.get('building').merge({isRequest}),
        builtPayment: Constants.makeBuiltPayment(),
        builtRequest: Constants.makeBuiltRequest(),
      })
    case WalletsGen.setBuildingPublicMemo:
      const {publicMemo} = action.payload
      return state.merge({
        building: state.get('building').merge({publicMemo}),
        builtPayment: state.get('builtPayment').merge({publicMemoErrMsg: new HiddenString('')}),
      })
    case WalletsGen.setBuildingRecipientType:
      const {recipientType} = action.payload
      return state.merge({
        building: state.get('building').merge({recipientType}),
        builtPayment: Constants.makeBuiltPayment(),
      })
    case WalletsGen.setBuildingSecretNote:
      const {secretNote} = action.payload
      return state.merge({
        building: state.get('building').merge({secretNote}),
        builtPayment: state.get('builtPayment').merge({secretNoteErrMsg: new HiddenString('')}),
        builtRequest: state.get('builtRequest').merge({secretNoteErrMsg: new HiddenString('')}),
      })
    case WalletsGen.setBuildingTo:
      const {to} = action.payload
      return state.merge({
        building: state.get('building').merge({to}),
        builtPayment: state.get('builtPayment').merge({toErrMsg: ''}),
        builtRequest: state.get('builtRequest').merge({toErrMsg: ''}),
      })
    case WalletsGen.sendAssetChoicesReceived:
      const {sendAssetChoices} = action.payload
      return state.merge({
        building: state.get('building').merge({sendAssetChoices}),
        builtPayment: Constants.makeBuiltPayment(),
      })
    case WalletsGen.buildingPaymentIDReceived:
      const {bid} = action.payload
      return state.merge({
        building: state.get('building').merge({bid}),
      })
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
    case WalletsGen.addNewPayment:
      const {accountID, paymentID} = action.payload
      return state.updateIn(['newPayments', accountID], newTxs =>
        newTxs ? newTxs.add(paymentID) : I.Set([paymentID])
      )
    case WalletsGen.clearNewPayments:
      return state.setIn(['newPayments', action.payload.accountID], I.Set())
    case WalletsGen.clearErrors:
      return state.merge({
        accountName: '',
        accountNameError: '',
        accountNameValidationState: 'none',
        builtPayment: state.get('builtPayment').merge({readyToSend: 'spinning'}),
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
    case WalletsGen.hideAirdropBanner:
      // set this immediately so it goes away immediately
      return state.merge({airdropShowBanner: false})
    case WalletsGen.updateAirdropBannerState:
      return state.merge({airdropShowBanner: action.payload.show})
    case WalletsGen.updatedAirdropDetails:
      return state.merge({airdropDetails: action.payload.details})
    case WalletsGen.setTrustlineExpanded:
      return state.update('trustline', trustline =>
        trustline.update('expandedAssets', expandedAssets =>
          action.payload.expanded
            ? expandedAssets.add(action.payload.trustlineAssetID)
            : expandedAssets.delete(action.payload.trustlineAssetID)
        )
      )
    // Saga only actions
    case WalletsGen.updateAirdropDetails:
    case WalletsGen.changeAirdrop:
    case WalletsGen.updateAirdropState:
    case WalletsGen.rejectDisclaimer:
    case WalletsGen.didSetAccountAsDefault:
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
    case WalletsGen.changedAccountName:
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
      return state
    default:
      return state
  }
}
