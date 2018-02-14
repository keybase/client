// @flow
import * as Types from '../../constants/types/chat2'
import * as Chat2Gen from '../../actions/chat2-gen'
import DeleteHistoryWarning from '.'
import {type RouteProps} from '../../route-tree/render-route'
import moment from 'moment'
import {compose, connect, type TypedState, type Dispatch} from '../../util/container'

type OwnProps = RouteProps<
  {
    message: Types.Message,
    teamname: string,
  },
  {}
>

const mapStateToProps = (state: TypedState, {routeProps}: OwnProps) => {
  const message = routeProps.get('message')
  const teamname = routeProps.get('teamname')
  const timestamp = moment(message.timestamp).format('dddd, MMMM Do YYYY, h:mm:ss a')
  return {
    teamname,
    timestamp,
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp, routeProps}: OwnProps) => ({
  onBack: () => dispatch(navigateUp()),
  onClose: () => dispatch(navigateUp()),
  onDeleteHistory: () => {
    const message = routeProps.get('message')
    dispatch(navigateUp())
    dispatch(
      Chat2Gen.createMessageDeleteHistory({
        conversationIDKey: message.conversationIDKey,
        ordinal: message.ordinal,
      })
    )
  },
})

const mergeProps = (stateProps, dispatchProps) => ({
  ...stateProps,
  ...dispatchProps,
  title: 'Delete message history',
})

export default compose(connect(mapStateToProps, mapDispatchToProps, mergeProps))(DeleteHistoryWarning)
