import Footer from '.'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import * as WalletsGen from '../../../actions/wallets-gen'
import * as Constants from '../../../constants/wallets'
import {namedConnect} from '../../../util/container'
import {anyWaiting} from '../../../constants/waiting'

type OwnProps = {
  isAdvanced?: boolean
  onConfirm?: () => void // if showing confirm form directly (not through routing)
}

const mapStateToProps = state => {
  const accountID = state.wallets.selectedAccount
  const {isRequest} = state.wallets.building
  const isReady = isRequest
    ? state.wallets.builtRequest.readyToRequest
    : state.wallets.builtPayment.readyToReview
  const currencyWaiting = anyWaiting(state, Constants.getDisplayCurrencyWaitingKey(accountID))
  const thisDeviceIsLockedOut = Constants.getAccount(state, accountID).deviceReadOnly
  return {
    disabled: !isReady || currencyWaiting || thisDeviceIsLockedOut,
    isRequest,
    thisDeviceIsLockedOut,
    waitingKey: state.wallets.building.isRequest
      ? Constants.requestPaymentWaitingKey
      : Constants.buildPaymentWaitingKey,
  }
}

const mapDispatchToProps = (dispatch, {onConfirm}: OwnProps) => ({
  onClickRequest: () => {
    dispatch(WalletsGen.createRequestPayment())
  },
  onClickSend: () => {
    dispatch(WalletsGen.createReviewPayment())
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [
          {
            props: {},
            selected: Constants.confirmFormRouteKey,
          },
        ],
      })
    )
  },
})

const mergeProps = (s, d, o) => ({
  disabled: s.disabled,
  isAdvanced: !!o.isAdvanced,
  onClickRequest: s.isRequest ? d.onClickRequest : undefined,
  onClickSend: s.isRequest ? undefined : d.onClickSend,
  thisDeviceIsLockedOut: s.thisDeviceIsLockedOut,
  waitingKey: s.waitingKey,
})

export default namedConnect(mapStateToProps, mapDispatchToProps, mergeProps, 'Footer')(Footer)
