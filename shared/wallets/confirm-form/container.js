// @flow
import ConfirmSend from '.'
import * as Constants from '../../constants/wallets'
import * as WalletsGen from '../../actions/wallets-gen'
import {connect, type TypedState} from '../../util/container'

const mapStateToProps = (state: TypedState) => {
  const build = state.wallets.buildingPayment
  const built = state.wallets.builtPayment
  const currency = state.wallets.currencies.find(c => c.code === build.currency)
  return {
    amount: build.amount,
    assetConversion: built.worthDescription,
    assetType: build.currency,
    symbol: currency ? currency.symbol : null,
    encryptedNote: build.secretNote.stringValue(),
    publicMemo: build.publicMemo.stringValue(),
    waitingKey: Constants.sendPaymentWaitingKey,
    yourUsername: state.config.username,
  }
}

const mapDispatchToProps = (dispatch, {navigateUp}) => ({
  onBack: () => dispatch(navigateUp()),
  onClose: () => dispatch(navigateUp()),
  onSendClick: () => dispatch(WalletsGen.createSendPayment()),
})

export default connect(mapStateToProps, mapDispatchToProps, (s, d, o) => ({...o, ...s, ...d}))(ConfirmSend)
