// @flow
import * as ChatGen from '../../actions/chat-gen'
import DeleteHistoryWarning from '.'
import moment from 'moment'
import {compose, connect, type TypedState} from '../../util/container'

const mapStateToProps = (state: TypedState, {routeProps}) => {
  const message = routeProps.get('message')
  const teamname = routeProps.get('teamname')
  const timestamp = moment(message.timestamp).format('dddd, MMMM Do YYYY, h:mm:ss a')
  return {
    teamname,
    timestamp,
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
