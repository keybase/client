// @flow
import SendForm from '.'
import {connect, type TypedState, type Dispatch} from '../../util/container'

const mapStateToProps = (state: TypedState) => ({})

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp}) => ({
  _onClose: () => dispatch(navigateUp()),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  onClose: dispatchProps._onClose,
  targetType: ownProps.routeProps.get('targetType'),
})

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(SendForm)
