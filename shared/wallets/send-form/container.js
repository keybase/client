// @flow
import SendForm from '.'
import {connect, type TypedState, type Dispatch} from '../../util/container'

const mapStateToProps = (state: TypedState) => ({})

const mapDispatchToProps = (dispatch: Dispatch) => ({})

const mergeProps = (stateProps, dispatchProps) => ({})

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(SendForm)
