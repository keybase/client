import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as WalletsGen from '../../actions/wallets-gen'
import * as Constants from '../../constants/wallets'
import * as Container from '../../util/container'
import SEP7Confirm from '.'

const mapStateToProps = (state: Container.TypedState) => ({
  _inputURI: state.wallets.sep7ConfirmURI,
  loading: !state.wallets.sep7ConfirmInfo,
  sep7ConfirmInfo: state.wallets.sep7ConfirmInfo,
  sep7ConfirmPath: state.wallets.sep7ConfirmPath,
  waitingKey: Constants.sep7WaitingKey,
})

const mapDispatchToProps = (dispatch: Container.TypedDispatch) => ({
  _onAcceptPath: (inputURI: string) => dispatch(WalletsGen.createAcceptSEP7Path({inputURI})),
  _onAcceptPay: (inputURI: string, amount: string) =>
    dispatch(WalletsGen.createAcceptSEP7Pay({amount, inputURI})),
  _onAcceptTx: (inputURI: string) => dispatch(WalletsGen.createAcceptSEP7Tx({inputURI})),
  onClose: () => dispatch(RouteTreeGen.createNavigateUp()),
  onLookupPath: () => dispatch(WalletsGen.createCalculateBuildingAdvanced({forSEP7: true})),
})

export default Container.connect(mapStateToProps, mapDispatchToProps, (stateProps, dispatchProps) => {
  if (stateProps.loading || !stateProps.sep7ConfirmInfo) {
    return {
      amount: null,
      assetCode: '',
      availableToSendNative: '',
      callbackURL: null,
      displayAmountFiat: '',
      loading: true,
      memo: null,
      memoType: null,
      message: null,
      onAcceptPath: () => null,
      onAcceptPay: () => null,
      onAcceptTx: () => null,
      onBack: dispatchProps.onClose,
      onLookupPath: () => null,
      operation: 'pay' as const,
      originDomain: '',
      path: stateProps.sep7ConfirmPath,
      recipient: null,
      signed: null,
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
    assetCode,
    availableToSendNative,
    callbackURL,
    displayAmountFiat,
    memo,
    memoType,
    message,
    originDomain,
    recipient,
    signed,
    summary,
  } = stateProps.sep7ConfirmInfo
  const path = stateProps.sep7ConfirmPath
  const rawOp = stateProps.sep7ConfirmInfo.operation
  const operation = rawOp === 'pay' ? ('pay' as const) : rawOp === 'tx' ? ('tx' as const) : ('' as const)

  if (operation === '') {
    throw new Error('invalid operation' + stateProps.sep7ConfirmInfo.operation)
  }

  return {
    amount,
    assetCode,
    availableToSendNative,
    callbackURL,
    displayAmountFiat,
    loading: stateProps.loading,
    memo,
    memoType,
    message,
    onAcceptPath: () => dispatchProps._onAcceptPath(stateProps._inputURI),
    onAcceptPay: (amount: string) => dispatchProps._onAcceptPay(stateProps._inputURI, amount),
    onAcceptTx: () => dispatchProps._onAcceptTx(stateProps._inputURI),
    onBack: dispatchProps.onClose,
    onLookupPath: dispatchProps.onLookupPath,
    operation,
    originDomain,
    path,
    recipient,
    signed,
    summary,
    waitingKey: stateProps.waitingKey,
  }
})(SEP7Confirm)
