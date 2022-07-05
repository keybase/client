import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as WalletsGen from '../../actions/wallets-gen'
import * as Constants from '../../constants/wallets'
import * as Container from '../../util/container'
import SEP7Confirm from '.'

const mapStateToProps = (state: Container.TypedState) => ({
  _inputURI: state.wallets.sep7ConfirmURI,
  builtPaymentAdvancedWaitingKey: Constants.calculateBuildingAdvancedWaitingKey,
  loading: !state.wallets.sep7ConfirmInfo,
  sep7ConfirmFromQR: state.wallets.sep7ConfirmFromQR,
  sep7ConfirmInfo: state.wallets.sep7ConfirmInfo,
  sep7ConfirmPath: state.wallets.sep7ConfirmPath,
  sep7SendError: state.wallets.sep7SendError,
  sep7WaitingKey: Constants.sep7WaitingKey,
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
      builtPaymentAdvancedWaitingKey: stateProps.builtPaymentAdvancedWaitingKey,
      callbackURL: null,
      displayAmountFiat: '',
      findPathError: stateProps.sep7ConfirmPath.findPathError,
      fromQRCode: false,
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
      sendError: stateProps.sep7SendError,
      sep7WaitingKey: stateProps.sep7WaitingKey,
      signed: null,
      summary: {
        fee: '',
        memo: '',
        memoType: '',
        operations: [],
        source: '',
      },
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
  const sendError = stateProps.sep7SendError
  const path = stateProps.sep7ConfirmPath
  const {findPathError} = path
  const rawOp = stateProps.sep7ConfirmInfo.operation
  const fromQRCode = stateProps.sep7ConfirmFromQR
  const operation = rawOp === 'pay' ? ('pay' as const) : rawOp === 'tx' ? ('tx' as const) : ('' as const)

  if (operation === '') {
    throw new Error('invalid operation' + stateProps.sep7ConfirmInfo.operation)
  }

  return {
    amount,
    assetCode,
    availableToSendNative,
    builtPaymentAdvancedWaitingKey: stateProps.builtPaymentAdvancedWaitingKey,
    callbackURL,
    displayAmountFiat,
    findPathError,
    fromQRCode,
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
    sendError,
    sep7WaitingKey: stateProps.sep7WaitingKey,
    signed,
    summary,
  }
})(SEP7Confirm)
