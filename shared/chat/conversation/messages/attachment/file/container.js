// @flow
import * as Types from '../../../../../constants/types/chat2'
import {connect, type TypedState, type Dispatch} from '../../../../../util/container'
import File from '.'

const mapStateToProps = (state: TypedState) => ({})

const mapDispatchToProps = (dispatch: Dispatch) => ({
  onClick: () => {},
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  message: ownProps.message,
  onClick: dispatchProps.onClick,
})

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(File)
