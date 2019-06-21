import * as Chat2Gen from '../../actions/chat2-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as WalletsGen from '../../actions/wallets-gen'
import * as Constants from '../../constants/wallets'
import * as WaitingConstants from '../../constants/waiting'
import SEP7Confirm from '.'
import {namedConnect} from '../../util/container'

type OwnProps = {}

const mapStateToProps = (state, ownProps: OwnProps) => {
  const {
    amount,
    assetCode,
    assetIssuer,
    callbackURL,
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
    amount,
    assetCode,
    assetIssuer,
    callbackURL,
    inputURI: state.wallets.sep7ConfirmURI,
    loading: !state.wallets.sep7ConfirmInfo,
    memo,
    memoType,
    message,
    operation,
    originDomain,
    recipient,
    summary,
    waiting: WaitingConstants.anyWaiting(state, Constants.sep7WaitingKey),
    waitingKey: Constants.sep7WaitingKey,
    xdr,
  }
}

const mapDispatchToProps = (dispatch, ownProps: OwnProps) => ({
  _onAcceptPay: (inputURI: string, amount: string) =>
    dispatch(WalletsGen.createAcceptSEP7Pay({amount, inputURI})),
  _onAcceptTx: (inputURI: string) => dispatch(WalletsGen.createAcceptSEP7Tx({inputURI})),
  onClose: () => dispatch(RouteTreeGen.createNavigateUp()),
})

export default namedConnect(
  mapStateToProps,
  mapDispatchToProps,
  (stateProps, dispatchProps, ownProps) => ({
    ...ownProps,
    ...stateProps,
    onAcceptPay: (amount: string) => dispatchProps._onAcceptPay(stateProps.inputURI, amount),
    onAcceptTx: () => dispatchProps._onAcceptTx(stateProps.inputURI),
    onClose: dispatchProps.onClose,
  }),
  'SEP7Confirm'
)(SEP7Confirm)
