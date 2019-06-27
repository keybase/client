import * as React from 'react'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as WalletsGen from '../../actions/wallets-gen'
import * as Constants from '../../constants/wallets'
import * as Container from '../../util/container'
import SEP7Confirm, {Props} from '.'

const mapStateToProps = (state: Container.TypedState) => ({
  inputURI: state.wallets.sep7ConfirmURI,
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

const SEP7ConfirmWrapper = (props: Props) => {
  const [userAmount, onChangeAmount] = React.useState('')
  return <SEP7Confirm {...props} userAmount={userAmount} onChangeAmount={onChangeAmount} />
}

export default Container.connect(
  mapStateToProps,
  mapDispatchToProps,
  (stateProps, dispatchProps, ownProps) => {
    const {
      amount,
      assetCode,
      availableToSendFiat,
      availableToSendNative,
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
    } = stateProps.sep7ConfirmInfo
    return {
      ...ownProps,
      amount,
      assetCode,
      assetIssuer,
      availableToSendFiat,
      availableToSendNative,
      callbackURL,
      displayAmountFiat,
      inputURI: stateProps.inputURI,
      loading: stateProps.loading,
      memo,
      memoType,
      message,
      onAcceptPay: (amount: string) => dispatchProps._onAcceptPay(stateProps.inputURI, amount),
      onAcceptTx: () => dispatchProps._onAcceptTx(stateProps.inputURI),
      onBack: dispatchProps.onClose,
      operation,
      originDomain,
      recipient,
      summary,
      waitingKey: stateProps.waitingKey,
      xdr,
    }
  }
)(SEP7ConfirmWrapper)
