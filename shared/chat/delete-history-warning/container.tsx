import * as Types from '../../constants/types/chat2'
import * as Chat2Gen from '../../actions/chat2-gen'
import * as Constants from '../../constants/chat2'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Container from '../../util/container'
import DeleteHistoryWarning from '.'

type OwnProps = Container.RouteProps<{conversationIDKey: Types.ConversationIDKey}>

export default Container.connect(
  () => ({}),
  (dispatch, ownProps: OwnProps) => ({
    onCancel: () => dispatch(RouteTreeGen.createNavigateUp()),
    onDeleteHistory: () => {
      const conversationIDKey = Container.getRouteProps(
        ownProps,
        'conversationIDKey',
        Constants.noConversationIDKey
      )
      dispatch(RouteTreeGen.createClearModals())
      dispatch(Chat2Gen.createMessageDeleteHistory({conversationIDKey}))
    },
  }),
  (_, dispatchProps, __: OwnProps) => ({
    onCancel: dispatchProps.onCancel,
    onDeleteHistory: dispatchProps.onDeleteHistory,
  })
)(DeleteHistoryWarning)
