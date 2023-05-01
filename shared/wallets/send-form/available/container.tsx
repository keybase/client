import Available from '.'
import * as Container from '../../../util/container'

export default () => {
  const amountErrMsg = Container.useSelector(state =>
    state.wallets.building.isRequest
      ? state.wallets.builtRequest.amountErrMsg
      : state.wallets.builtPayment.amountErrMsg
  )
  const props = {
    amountErrMsg,
  }
  return <Available {...props} />
}
