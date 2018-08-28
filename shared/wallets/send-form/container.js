// @flow
import SendForm from '.'
import {connect, type TypedState} from '../../util/container'

const mapStateToProps = (state: TypedState) => ({})

const mapDispatchToProps = (dispatch, {navigateUp}) => ({
  onClose: () => dispatch(navigateUp()),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  isRequest: !!ownProps.isRequest,
  onClose: dispatchProps.onClose,
  onClick: () => {},
})

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(SendForm)
