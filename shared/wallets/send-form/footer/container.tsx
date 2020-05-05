import Footer from '.'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import * as WalletsGen from '../../../actions/wallets-gen'
import * as Constants from '../../../constants/wallets'
import * as Types from '../../../constants/types/wallets'
import * as Container from '../../../util/container'
import {anyWaiting} from '../../../constants/waiting'

type OwnProps = {
  onConfirm?: () => void // if showing confirm form directly (not through routing)
}

const mapStateToProps = (state: Container.TypedState) => {
  const accountID = state.wallets.building.from
  let thisDeviceIsLockedOut = false
  if (Types.isValidAccountID(accountID)) {
    thisDeviceIsLockedOut = Constants.getAccount(state, accountID).deviceReadOnly
  } else {
    thisDeviceIsLockedOut = Constants.getDefaultAccount(state.wallets).deviceReadOnly
  }
  const {isRequest} = state.wallets.building
  const isReady = isRequest
    ? state.wallets.builtRequest.readyToRequest
    : state.wallets.builtPayment.readyToReview
  const currencyWaiting = anyWaiting(state, Constants.getDisplayCurrencyWaitingKey(accountID))
  return {
    calculating:
      !!state.wallets.building.amount &&
      (anyWaiting(state, Constants.buildPaymentWaitingKey) ||
        anyWaiting(state, Constants.requestPaymentWaitingKey)),
    disabled: !isReady || currencyWaiting || thisDeviceIsLockedOut,
    isRequest,
    thisDeviceIsLockedOut,
    waitingKey: state.wallets.building.isRequest
      ? Constants.requestPaymentWaitingKey
      : Constants.buildPaymentWaitingKey,
    worthDescription: isRequest
      ? state.wallets.builtRequest.worthDescription
      : state.wallets.builtPayment.worthDescription,
  }
}

const mapDispatchToProps = (dispatch: Container.TypedDispatch) => ({
  onClickRequest: () => {
    dispatch(WalletsGen.createRequestPayment())
  },
  onClickSend: () => {
    dispatch(WalletsGen.createReviewPayment())
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [{props: {}, selected: Constants.confirmFormRouteKey}],
      })
    )
  },
})

export default Container.namedConnect(
  mapStateToProps,
  mapDispatchToProps,
  (s, d, _: OwnProps) => ({
    calculating: s.calculating,
    disabled: s.disabled,
    onClickRequest: s.isRequest ? d.onClickRequest : undefined,
    onClickSend: s.isRequest ? undefined : d.onClickSend,
    thisDeviceIsLockedOut: s.thisDeviceIsLockedOut,
    waitingKey: s.waitingKey,
    worthDescription: s.worthDescription,
  }),
  'Footer'
)(Container.safeSubmit(['onClickRequest'], ['calculating'])(Footer))
