// @flow
import SendForm from '.'
import * as WalletsGen from '../../actions/wallets-gen'
import {connect, type TypedState} from '../../util/container'

const mapStateToProps = (state: TypedState) => ({})

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
