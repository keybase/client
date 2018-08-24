// @flow
import * as I from 'immutable'
import * as Constants from '../constants/wallets'
import * as Types from '../constants/types/wallets'
import * as WalletsGen from '../actions/wallets-gen'
import HiddenString from '../util/hidden-string'

const initialState: Types.State = Constants.makeState()

export default function(state: Types.State = initialState, action: WalletsGen.Actions) {
  switch (action.type) {
    case WalletsGen.resetStore:
      return initialState
    case WalletsGen.accountsReceived:
      const accountMap = I.Map(action.payload.accounts.map(account => [account.accountID, account]))
      return state.set('accountMap', accountMap)
    case WalletsGen.assetsReceived:
      return state.setIn(['assetsMap', action.payload.accountID], I.List(action.payload.assets))
    case WalletsGen.builtPaymentReceived:
      return state.set(
        'builtPayment',
        state.get('builtPayment').merge(Constants.makeBuiltPayment(action.payload.build))
      )
    case WalletsGen.clearBuildingPayment:
      return state.set('buildingPayment', Constants.makeBuildingPayment())
    case WalletsGen.clearBuiltPayment:
      return state.set('builtPayment', Constants.makeBuiltPayment())
    case WalletsGen.paymentDetailReceived:
      return state.updateIn(['paymentsMap', action.payload.accountID], payments =>
        payments.update(payments.findIndex(p => p.id === action.payload.paymentID), payment =>
          payment.merge({
            publicMemo: action.payload.publicMemo,
            publicMemoType: action.payload.publicMemoType,
            txID: action.payload.txID,
          })
        )
      )
    case WalletsGen.paymentsReceived:
      return state
        .setIn(['paymentsMap', action.payload.accountID], I.List(action.payload.payments))
        .setIn(['pendingMap', action.payload.accountID], I.List(action.payload.pending))
    case WalletsGen.secretKeyReceived:
      return state.set('exportedSecretKey', action.payload.secretKey)
    case WalletsGen.secretKeySeen:
      return state.set('exportedSecretKey', new HiddenString(''))
    case WalletsGen.selectAccount:
      return state
        .set('exportedSecretKey', new HiddenString(''))
        .set('selectedAccount', action.payload.accountID)
    case WalletsGen.setBuildingAmount:
      const {amount} = action.payload
      return state.set('buildingPayment', state.get('buildingPayment').merge({amount}))
    case WalletsGen.setBuildingCurrency:
      const {currency} = action.payload
      return state.set('buildingPayment', state.get('buildingPayment').merge({currency}))
    case WalletsGen.setBuildingFrom:
      const {from} = action.payload
      return state.set('buildingPayment', state.get('buildingPayment').merge({from}))
    case WalletsGen.setBuildingPublicMemo:
      const {publicMemo} = action.payload
      return state.set('buildingPayment', state.get('buildingPayment').merge({publicMemo}))
    case WalletsGen.setBuildingRecipientType:
      const {recipientType} = action.payload
      return state.set('buildingPayment', state.get('buildingPayment').merge({recipientType}))
    case WalletsGen.setBuildingSecretNote:
      const {secretNote} = action.payload
      return state.set('buildingPayment', state.get('buildingPayment').merge({secretNote}))
    case WalletsGen.setBuildingTo:
      const {to} = action.payload
      return state.set('buildingPayment', state.get('buildingPayment').merge({to}))
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
      })
    case WalletsGen.createdNewAccount:
      return action.error
        ? state.set('createNewAccountError', action.payload.error)
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
        ? state.set('linkExistingAccountError', action.payload.error)
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
    // Saga only actions
    case WalletsGen.buildPayment:
    case WalletsGen.createNewAccount:
    case WalletsGen.exportSecretKey:
    case WalletsGen.linkExistingAccount:
    case WalletsGen.loadAssets:
    case WalletsGen.loadPaymentDetail:
    case WalletsGen.loadPayments:
    case WalletsGen.loadAccounts:
    case WalletsGen.refreshPayments:
    case WalletsGen.sendPayment:
    case WalletsGen.sentPayment:
      return state
    default:
      /*::
      declare var ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove: (action: empty) => any
      ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove(action);
      */
      return state
  }
}
