import * as Types from '../../constants/types/chat2'
import * as Chat2Gen from '../../actions/chat2-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import DeleteHistoryWarning from '.'
import * as Container from '../../util/container'

type OwnProps = Container.RouteProps<{conversationIDKey: Types.ConversationIDKey}>

export default Container.connect(
  () => ({}),
  (dispatch, ownProps: OwnProps) => ({
    onBack: Container.isMobile ? null : () => dispatch(RouteTreeGen.createNavigateUp()),
    onCancel: () => dispatch(RouteTreeGen.createNavigateUp()),
    onDeleteHistory: () => {
      const conversationIDKey = Container.getRouteProps(ownProps, 'conversationIDKey')
      dispatch(RouteTreeGen.createNavigateUp())
      dispatch(Chat2Gen.createMessageDeleteHistory({conversationIDKey}))
    },
  }),
  (_, dispatchProps, __: OwnProps) => ({
    onBack: dispatchProps.onBack,
    onCancel: dispatchProps.onCancel,
    onDeleteHistory: dispatchProps.onDeleteHistory,
  })
)(DeleteHistoryWarning)
