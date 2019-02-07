// @flow
import Footer from '.'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import * as WalletsGen from '../../../actions/wallets-gen'
import * as Constants from '../../../constants/wallets'
import {namedConnect, isMobile} from '../../../util/container'
import {anyWaiting} from '../../../constants/waiting'

type OwnProps = {
  onConfirm?: () => void, // if showing confirm form directly (not through routing)
}

const mapStateToProps = state => {
  const accountID = state.wallets.selectedAccount
  const {isRequest} = state.wallets.building
  const isReady = isRequest
    ? state.wallets.builtRequest.readyToRequest
    : state.wallets.builtPayment.readyToReview
  const currencyWaiting = anyWaiting(state, Constants.getDisplayCurrencyWaitingKey(accountID))
  const sendDisabledDueToMobileOnly = !isMobile && !!state.wallets.mobileOnlyMap.get(accountID)
  return {
    calculating: !!state.wallets.building.amount,
    disabled: !isReady || currencyWaiting || sendDisabledDueToMobileOnly,
    isRequest,
    waitingKey: state.wallets.building.isRequest
      ? Constants.requestPaymentWaitingKey
      : Constants.buildPaymentWaitingKey,
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
  calculating: s.calculating,
  disabled: s.disabled,
  onClickRequest: s.isRequest ? d.onClickRequest : undefined,
  onClickSend: s.isRequest ? undefined : d.onClickSend,
  waitingKey: s.waitingKey,
  worthDescription: s.worthDescription,
})

export default namedConnect<OwnProps, _, _, _, _>(mapStateToProps, mapDispatchToProps, mergeProps, 'Footer')(
  Footer
)
