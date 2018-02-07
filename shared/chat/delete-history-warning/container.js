// @flow
import * as ChatGen from '../../actions/chat-gen'
import DeleteHistoryWarning from '.'
import {compose, connect, type TypedState} from '../../util/container'

const mapStateToProps = (state: TypedState, {routeProps}) => {
  return {
    teamname: routeProps.get('teamname'),
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp, routeProps}) => ({
  onClose: () => dispatch(navigateUp()),
  onDeleteHistory: () => {
    dispatch(ChatGen.createDeleteMessageHistory({message: routeProps.get('message')}))
  },
})

const mergeProps = (stateProps, dispatchProps) => ({
  ...stateProps,
  ...dispatchProps,
})

export default compose(connect(mapStateToProps, mapDispatchToProps, mergeProps))(DeleteHistoryWarning)
