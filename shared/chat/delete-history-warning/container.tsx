import * as Types from '../../constants/types/chat2'
import * as Chat2Gen from '../../actions/chat2-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import DeleteHistoryWarning from '.'
import {compose, connect, isMobile, getRouteProps, RouteProps} from '../../util/container'

type OwnProps = RouteProps<
  {
    conversationIDKey: Types.ConversationIDKey
  },
  {}
>

const mapStateToProps = () => ({})

const mapDispatchToProps = (dispatch, ownProps: OwnProps) => {
  return {
    onBack: isMobile ? null : () => dispatch(RouteTreeGen.createNavigateUp()),
    onCancel: () => dispatch(RouteTreeGen.createNavigateUp()),
    onDeleteHistory: () => {
      const conversationIDKey = getRouteProps(ownProps, 'conversationIDKey')
      dispatch(RouteTreeGen.createNavigateUp())
      dispatch(Chat2Gen.createMessageDeleteHistory({conversationIDKey}))
    },
  }
}

const mergeProps = (stateProps, dispatchProps) => ({
  onBack: dispatchProps.onBack,
  onCancel: dispatchProps.onCancel,
  onDeleteHistory: dispatchProps.onDeleteHistory,
})

export default compose(
  connect(
    mapStateToProps,
    mapDispatchToProps,
    mergeProps
  )
)(DeleteHistoryWarning)
