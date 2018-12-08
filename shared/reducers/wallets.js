// @flow
import logger from '../logger'
import * as I from 'immutable'
import * as Constants from '../constants/wallets'
import * as Types from '../constants/types/wallets'
import * as WalletsGen from '../actions/wallets-gen'
import HiddenString from '../util/hidden-string'
import * as Flow from '../util/flow'

const initialState: Types.State = Constants.makeState()

export default function(state: Types.State = initialState, action: WalletsGen.Actions): Types.State {
  switch (action.type) {
    case WalletsGen.resetStore:
      return initialState
    case WalletsGen.accountsReceived:
      const accountMap = I.OrderedMap(action.payload.accounts.map(account => [account.accountID, account]))
      return state.merge({accountMap: accountMap})
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
    case WalletsGen.clearBuilding:
      return state.merge({building: Constants.makeBuilding()})
    case WalletsGen.clearBuiltPayment:
      return state.merge({builtPayment: Constants.makeBuiltPayment()})
    case WalletsGen.clearBuiltRequest:
      return state.merge({builtRequest: Constants.makeBuiltRequest()})
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
    case WalletsGen.displayCurrenciesReceived:
      return state.merge({currencies: I.List(action.payload.currencies)})
    case WalletsGen.displayCurrencyReceived:
      // $FlowIssue thinks state is _State
      return state.withMutations(stateMutable => {
        if (action.payload.accountID) {
          stateMutable.update('currencyMap', c => c.set(action.payload.accountID, action.payload.currency))
        }
        if (action.payload.setBuildingCurrency) {
          const currency = state.lastSentXLM ? 'XLM' : action.payload.currency.code
          logger.info(
            `displayCurrencyReceived: setting currency to ${currency} because lastSentXLM was ${String(
              state.lastSentXLM
            )}`
          )
          stateMutable.update('building', b => b.merge({currency}))
        }
      })
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
    case WalletsGen.setLastSentXLM:
      return state.merge({lastSentXLM: action.payload.lastSentXLM})
    case WalletsGen.setReadyToSend:
      return state.set(
        'builtPayment',
        state.get('builtPayment').merge({readyToSend: action.payload.readyToSend})
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
        accountNameError: (action.error && action.payload.error) || '',
        accountNameValidationState: action.error ? 'error' : 'valid',
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
        secretKeyError: action.error ? action.payload.error : '',
        secretKeyValidationState: action.error ? 'error' : 'valid',
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
        createNewAccountError: '',
        linkExistingAccountError: '',
        secretKey: new HiddenString(''),
        secretKeyError: '',
        secretKeyValidationState: 'none',
        sentPaymentError: '',
      })
    case WalletsGen.createdNewAccount:
      return action.error
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
      return action.error
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
    case WalletsGen.requestDetailReceived:
      const request = Constants.requestResultToRequest(action.payload.request)
      return request ? state.update('requests', r => r.set(request.id, request)) : state
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
    // Saga only actions
    case WalletsGen.acceptDisclaimer:
      return state.merge({
        acceptingDisclaimerDelay: true,
      })
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
    case WalletsGen.loadRequestDetail:
    case WalletsGen.refreshPayments:
    case WalletsGen.sendPayment:
    case WalletsGen.sentPayment:
    case WalletsGen.requestPayment:
    case WalletsGen.requestedPayment:
    case WalletsGen.abandonPayment:
    case WalletsGen.loadSendAssetChoices:
    case WalletsGen.openSendRequestForm:
      return state
    default:
      Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(action)
      return state
  }
}
