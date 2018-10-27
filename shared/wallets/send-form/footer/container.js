// @flow
import Footer from '.'
import * as Route from '../../../actions/route-tree'
import * as WalletsGen from '../../../actions/wallets-gen'
import * as Constants from '../../../constants/wallets'
import {compose, connect, setDisplayName} from '../../../util/container'

type OwnProps = {
  onConfirm?: () => void, // if showing confirm form directly (not through routing)
}

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

const mapDispatchToProps = (dispatch, {onConfirm}: OwnProps) => ({
  onClickRequest: () => {
    dispatch(WalletsGen.createRequestPayment())
  },
  onClickSend: () => {
    dispatch(WalletsGen.createBuildPayment())
    onConfirm
      ? onConfirm()
      : dispatch(
          Route.navigateAppend([
            {
              props: {},
              selected: Constants.confirmFormRouteKey,
            },
          ])
        )
  },
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
