// @flow
import ConfirmSend from '.'
import * as Constants from '../../constants/wallets'
import * as WalletsGen from '../../actions/wallets-gen'
import {connect, type TypedState, type Dispatch} from '../../util/container'

const mapStateToProps = (state: TypedState) => ({
  amount: state.wallets.get('buildingPayment').get('amount'),
  assetConversion: state.wallets.get('builtPayment').get('worthDescription'),
  assetType: state.wallets.get('buildingPayment').get('currency'),
  encryptedNote: state.wallets
    .get('buildingPayment')
    .get('secretNote')
    .stringValue(),
  publicMemo: state.wallets.get('buildingPayment').get('publicMemo'),
  receiverUsername: state.wallets.get('builtPayment').get('toUsername'),
  recipientType: state.wallets.get('buildingPayment').get('recipientType'),
  waitingKey: Constants.sendPaymentWaitingKey,
  yourUsername: state.config.username,
})

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp}) => ({
  onBack: () => dispatch(navigateUp()),
  onClose: () => dispatch(navigateUp()),
  onSendClick: () => dispatch(WalletsGen.createSendPayment()),
})

export default connect(mapStateToProps, mapDispatchToProps)(ConfirmSend)
