// @flow
import Available from '.'
import {namedConnect} from '../../../util/container'

const mapStateToProps = state => ({
  amountErrMsg: state.wallets.building.isRequest
    ? state.wallets.builtRequest.amountErrMsg
    : state.wallets.builtPayment.amountErrMsg,
})

const mapDispatchToProps = dispatch => ({})

export default namedConnect(
  mapStateToProps,
  mapDispatchToProps,
  (s, d, o) => ({...o, ...s, ...d}),
  'Available'
)(Available)
