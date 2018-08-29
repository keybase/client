// @flow
import SendForm from '.'
import * as WalletsGen from '../../actions/wallets-gen'
import {connect, type TypedState} from '../../util/container'

const mapStateToProps = (state: TypedState) => ({})

const mapDispatchToProps = (dispatch, {navigateUp}) => ({
  onClose: () => {
    dispatch(navigateUp())
    dispatch(WalletsGen.createClearBuildingPayment())
    dispatch(WalletsGen.createClearBuiltPayment())
  },
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  isRequest: !!ownProps.isRequest,
  onClose: dispatchProps.onClose,
})

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(SendForm)
