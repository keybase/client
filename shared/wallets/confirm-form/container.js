// @flow
import ConfirmSend from '.'
import * as Constants from '../../constants/wallets'
import * as WalletsGen from '../../actions/wallets-gen'
import {connect, type TypedState} from '../../util/container'

const mapStateToProps = (state: TypedState) => {
  const build = state.wallets.buildingPayment
  const built = state.wallets.builtPayment
  return {
    amount: build.amount,
    assetConversion: built.worthDescription,
    assetType: build.currency,
    encryptedNote: build.secretNote.stringValue(),
    publicMemo: build.publicMemo.stringValue(),
    receiverUsername: built.toUsername,
    recipientType: build.recipientType,
    waitingKey: Constants.sendPaymentWaitingKey,
    yourUsername: state.config.username,
  }
}

const mapDispatchToProps = (dispatch, {navigateUp}) => ({
  onBack: () => dispatch(navigateUp()),
  onClose: () => dispatch(navigateUp()),
  onSendClick: () => dispatch(WalletsGen.createSendPayment()),
})

export default connect(mapStateToProps, mapDispatchToProps, (s, d, o) => ({...s, ...d, ...o}))(ConfirmSend)
