import * as Chat2Gen from '../../actions/chat2-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
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
    loading: !state.wallets.sep7ConfirmInfo,
    memo,
    memoType,
    message,
    operation,
    originDomain,
    recipient,
    summary,
    xdr,
  }
}

const mapDispatchToProps = (dispatch, ownProps: OwnProps) => ({
  onAccept: () => {
    dispatch(Chat2Gen.createConfirmScreenResponse({accept: true}))
  },
  onClose: () => dispatch(RouteTreeGen.createNavigateUp()),
})

export default namedConnect(
  mapStateToProps,
  mapDispatchToProps,
  (s, d, o) => ({...o, ...s, ...d}),
  'SEP7Confirm'
)(SEP7Confirm)
