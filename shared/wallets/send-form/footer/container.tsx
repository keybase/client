import * as Constants from '../../../constants/wallets'
import * as Container from '../../../util/container'
import * as React from 'react'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import * as Types from '../../../constants/types/wallets'
import * as WalletsGen from '../../../actions/wallets-gen'
import Footer from '.'
import {anyWaiting} from '../../../constants/waiting'

const FooterContainer = () => {
  const accountID = Container.useSelector(state => state.wallets.building.from)
  const thisDeviceIsLockedOut = Container.useSelector(state =>
    Types.isValidAccountID(accountID)
      ? Constants.getAccount(state, accountID).deviceReadOnly
      : Constants.getDefaultAccount(state.wallets).deviceReadOnly
  )
  const isRequest = Container.useSelector(state => state.wallets.building.isRequest)
  const isReady = Container.useSelector(state =>
    isRequest ? state.wallets.builtRequest.readyToRequest : state.wallets.builtPayment.readyToReview
  )
  const currencyWaiting = Container.useSelector(state =>
    anyWaiting(state, Constants.getDisplayCurrencyWaitingKey(accountID))
  )

  const worthDescription = Container.useSelector(state =>
    isRequest ? state.wallets.builtRequest.worthDescription : state.wallets.builtPayment.worthDescription
  )

  const waitingKey = isRequest ? Constants.requestPaymentWaitingKey : Constants.buildPaymentWaitingKey

  const calculating = Container.useSelector(
    state =>
      !!state.wallets.building.amount &&
      (anyWaiting(state, Constants.buildPaymentWaitingKey) ||
        anyWaiting(state, Constants.requestPaymentWaitingKey))
  )

  const disabled = !isReady || currencyWaiting || thisDeviceIsLockedOut

  const dispatch = Container.useDispatch()

  const _onClickRequest = React.useCallback(() => {
    dispatch(WalletsGen.createRequestPayment())
  }, [dispatch])

  const onClickRequest = Container.useSafeSubmit(_onClickRequest, calculating)

  const onClickSend = React.useCallback(() => {
    dispatch(WalletsGen.createReviewPayment())
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [Constants.confirmFormRouteKey],
      })
    )
  }, [dispatch])

  const np = {
    calculating,
    disabled,
    onClickRequest: isRequest ? onClickRequest : undefined,
    onClickSend: isRequest ? undefined : onClickSend,
    thisDeviceIsLockedOut,
    waitingKey,
    worthDescription,
  }

  return <Footer {...np} />
}
export default FooterContainer
