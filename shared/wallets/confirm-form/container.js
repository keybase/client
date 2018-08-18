// @flow
import ConfirmSend from '.'
import * as Constants from '../../constants/wallets'
import * as WalletsGen from '../../actions/wallets-gen'
import {connect, type TypedState, type Dispatch} from '../../util/container'

const mapStateToProps = (state: TypedState) => ({
  amount: state.wallets.buildingPayment.amount,
  assetConversion: state.wallets.builtPayment.worthDescription,
  assetType: state.wallets.buildingPayment.currency,
  encryptedNote: state.wallets.buildingPayment.secretNote.stringValue(),
  publicMemo: state.wallets.buildingPayment.publicMemo.stringValue(),
  receiverUsername: state.wallets.builtPayment.toUsername,
  recipientType: state.wallets.buildingPayment.recipientType,
  waitingKey: Constants.sendPaymentWaitingKey,
  yourUsername: state.config.username,
})

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp}) => ({
  onBack: () => dispatch(navigateUp()),
  onClose: () => dispatch(navigateUp()),
  onSendClick: () => dispatch(WalletsGen.createSendPayment()),
})

export default connect(mapStateToProps, mapDispatchToProps)(ConfirmSend)
