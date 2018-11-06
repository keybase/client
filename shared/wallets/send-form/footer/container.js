// @flow
import Footer from '.'
import * as Route from '../../../actions/route-tree'
import * as WalletsGen from '../../../actions/wallets-gen'
import * as Constants from '../../../constants/wallets'
import {namedConnect} from '../../../util/container'
import {anyWaiting} from '../../../constants/waiting'

type OwnProps = {
  onConfirm?: () => void, // if showing confirm form directly (not through routing)
}

const mapStateToProps = state => {
  const {isRequest} = state.wallets.building
  const isReady = isRequest
    ? state.wallets.builtRequest.readyToRequest
    : state.wallets.builtPayment.readyToSend
  const currencyWaiting = anyWaiting(state, Constants.loadDisplayCurrencyWaitingKey)
  return {
    calculating: !!state.wallets.building.amount,
    disabled: !isReady || currencyWaiting,
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
    dispatch(
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

export default namedConnect(mapStateToProps, mapDispatchToProps, mergeProps, 'Footer')(Footer)
