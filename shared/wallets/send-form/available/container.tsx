import Available from '.'
import * as Container from '../../../util/container'

type OwnProps = {}

const mapStateToProps = state => ({
  amountErrMsg: state.wallets.building.isRequest
    ? state.wallets.builtRequest.amountErrMsg
    : state.wallets.builtPayment.amountErrMsg,
})

const mapDispatchToProps = () => ({})

export default Container.connect(mapStateToProps, mapDispatchToProps, (s, d, o: OwnProps) => ({
  ...o,
  ...s,
  ...d,
}))(Available)
