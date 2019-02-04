// @flow
import SendRequestForm from '.'
import * as WalletsGen from '../../actions/wallets-gen'
import {connect} from '../../util/container'

type OwnProps = {||}

const mapStateToProps = state => ({
  isRequest: state.wallets.building.isRequest,
})

const mapDispatchToProps = (dispatch, {navigateUp}) => ({
  onClose: () => dispatch(WalletsGen.createAbandonPayment()),
})

const mergeProps = ({isRequest}, {onClose}) => ({
  isRequest,
  onClose,
})

export default connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(SendRequestForm)
