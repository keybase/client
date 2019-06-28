import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as WalletsGen from '../../actions/wallets-gen'
import * as Constants from '../../constants/wallets'
import * as Container from '../../util/container'
import SEP7Confirm from '.'

const mapStateToProps = (state: Container.TypedState) => ({
  _inputURI: state.wallets.sep7ConfirmURI,
  loading: !state.wallets.sep7ConfirmInfo,
  sep7ConfirmInfo: state.wallets.sep7ConfirmInfo,
  waitingKey: Constants.sep7WaitingKey,
})

const mapDispatchToProps = (dispatch: Container.TypedDispatch) => ({
  _onAcceptPay: (inputURI: string, amount: string) =>
    dispatch(WalletsGen.createAcceptSEP7Pay({amount, inputURI})),
  _onAcceptTx: (inputURI: string) => dispatch(WalletsGen.createAcceptSEP7Tx({inputURI})),
  onClose: () => dispatch(RouteTreeGen.createNavigateUp()),
})

const Connected = Container.connect(mapStateToProps, mapDispatchToProps, (stateProps, dispatchProps) => {
  if (stateProps.loading) {
    return {
      amount: null,
      availableToSendNative: '',
      callbackURL: null,
      displayAmountFiat: '',
      loading: true,
      memo: null,
      memoType: null,
      message: null,
      onAcceptPay: (amount: string) => null,
      onAcceptTx: () => null,
      onBack: dispatchProps.onClose,
      operation: 'pay',
      originDomain: '',
      recipient: null,
      summary: {
        fee: '',
        memo: '',
        memoType: '',
        operations: [],
        source: '',
      },
      waitingKey: stateProps.waitingKey,
    }
  }
  const {
    amount,
    availableToSendNative,
    callbackURL,
    displayAmountFiat,
    memo,
    memoType,
    message,
    operation,
    originDomain,
    recipient,
    summary,
  } = stateProps.sep7ConfirmInfo
  return {
    amount,
    availableToSendNative,
    callbackURL,
    displayAmountFiat,
    loading: stateProps.loading,
    memo,
    memoType,
    message,
    onAcceptPay: (amount: string) => dispatchProps._onAcceptPay(stateProps._inputURI, amount),
    onAcceptTx: () => dispatchProps._onAcceptTx(stateProps._inputURI),
    onBack: dispatchProps.onClose,
    operation,
    originDomain,
    recipient,
    summary,
    waitingKey: stateProps.waitingKey,
  }
})(SEP7Confirm)

export default Connected
