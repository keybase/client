// @flow
import Footer from '.'
import * as WalletsGen from '../../../actions/wallets-gen'
import {compose, connect, setDisplayName} from '../../../util/container'

const mapStateToProps = state => {
  const {isRequest} = state.wallets.building
  return {
    calculating: !!state.wallets.building.amount,
    disabled: !(isRequest
      ? state.wallets.builtRequest.readyToRequest
      : state.wallets.builtPayment.readyToSend),
    isRequest,
    waitingKey: Constants.buildPaymentWaitingKey,
    worthDescription: isRequest
      ? state.wallets.builtRequest.worthDescription
      : state.wallets.builtPayment.worthDescription,
  }
}

const mapDispatchToProps = (dispatch, {onConfirm}) => ({
  onClickRequest: () => {
    dispatch(WalletsGen.createRequestPayment())
  },
  onClickSend: onConfirm,
})

const mergeProps = (s, d, o) => ({
  calculating: s.calculating,
  disabled: s.disabled,
  onClickRequest: s.isRequest ? d.onClickRequest : undefined,
  onClickSend: s.isRequest ? undefined : d.onClickSend,
  waitingKey: s.waitingKey,
  worthDescription: s.worthDescription,
})

export default compose(
  connect(
    mapStateToProps,
    mapDispatchToProps,
    mergeProps
  ),
  setDisplayName('Footer')
)(Footer)
