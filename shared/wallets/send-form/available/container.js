// @flow
import Available from '.'
import {namedConnect} from '../../../util/container'

type OwnProps = {||}

const mapStateToProps = state => ({
  amountErrMsg: state.wallets.building.isRequest
    ? state.wallets.builtRequest.amountErrMsg
    : state.wallets.builtPayment.amountErrMsg,
})

const mapDispatchToProps = dispatch => ({})

export default namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  (s, d, o) => ({...o, ...s, ...d}),
  'Available'
)(Available)
