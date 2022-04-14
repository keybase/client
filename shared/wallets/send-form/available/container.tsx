import Available from '.'
import * as Container from '../../../util/container'

type OwnProps = {}

export default Container.connect(
  state => ({
    amountErrMsg: state.wallets.building.isRequest
      ? state.wallets.builtRequest.amountErrMsg
      : state.wallets.builtPayment.amountErrMsg,
  }),
  () => ({}),
  (s, d, o: OwnProps) => ({...o, ...s, ...d})
)(Available)
