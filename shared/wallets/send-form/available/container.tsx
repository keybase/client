import Available from '.'
import {namedConnect} from '../../../util/container'

type OwnProps = {}

const mapStateToProps = state => ({
  amountErrMsg: state.wallets.building.isRequest
    ? state.wallets.builtRequest.amountErrMsg
    : state.wallets.builtPayment.amountErrMsg,
})

const mapDispatchToProps = () => ({})

export default namedConnect(
  mapStateToProps,
  mapDispatchToProps,
  (s, d, o: OwnProps) => ({...o, ...s, ...d}),
  'Available'
)(Available)
