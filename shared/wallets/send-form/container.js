// @flow
import SendForm from '.'
import * as WalletsGen from '../../actions/wallets-gen'
import {connect} from '../../util/container'

const mapStateToProps = state => ({})

const mapDispatchToProps = (dispatch, {navigateUp}) => ({
  onClose: () => dispatch(WalletsGen.createAbandonPayment()),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  isRequest: !!ownProps.routeProps.get('isRequest'),
  onClose: dispatchProps.onClose,
})

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(SendForm)
