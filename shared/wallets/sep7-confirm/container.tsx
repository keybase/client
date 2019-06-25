import * as React from 'react'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as WalletsGen from '../../actions/wallets-gen'
import * as Constants from '../../constants/wallets'
import * as Container from '../../util/container'
import SEP7Confirm from '.'

const mapStateToProps = (state: Container.TypedState) => {
  const error = state.wallets.sep7ConfirmError
  if (error) {
    return {error}
  }

  const {
    amount,
    availableToSendFiat,
    availableToSendNative,
    assetCode,
    assetIssuer,
    callbackURL,
    displayAmountFiat,
    memo,
    memoType,
    message,
    operation,
    originDomain,
    recipient,
    summary,
    xdr,
  } = state.wallets.sep7ConfirmInfo

  return {
    amount: '',
    assetCode,
    assetIssuer,
    availableToSendFiat,
    availableToSendNative,
    callbackURL,
    displayAmountFiat,
    error,
    inputURI: state.wallets.sep7ConfirmURI,
    loading: !state.wallets.sep7ConfirmInfo,
    memo,
    memoType,
    message,
    operation,
    originDomain,
    recipient,
    summary,
    waitingKey: Constants.sep7WaitingKey,
    xdr,
  }
}

const mapDispatchToProps = (dispatch: Container.TypedDispatch) => ({
  _onAcceptPay: (inputURI: string, amount: string) =>
    dispatch(WalletsGen.createAcceptSEP7Pay({amount, inputURI})),
  _onAcceptTx: (inputURI: string) => dispatch(WalletsGen.createAcceptSEP7Tx({inputURI})),
  onClose: () => dispatch(RouteTreeGen.createNavigateUp()),
})

export default Container.namedConnect(
  mapStateToProps,
  mapDispatchToProps,
  (stateProps, dispatchProps, ownProps) => ({
    ...ownProps,
    ...stateProps,
    onAcceptPay: (amount: string) => dispatchProps._onAcceptPay(stateProps.inputURI, amount),
    onAcceptTx: () => dispatchProps._onAcceptTx(stateProps.inputURI),
    onBack: dispatchProps.onClose,
  }),
  'SEP7Confirm'
)(SEP7Confirm)
