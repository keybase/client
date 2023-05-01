import * as Chat2Gen from '../../actions/chat2-gen'
import * as Constants from '../../constants/chat2'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Container from '../../util/container'
import DeleteHistoryWarning from '.'

type OwnProps = Container.RouteProps<'chatDeleteHistoryWarning'>

export default (ownProps: OwnProps) => {
  const dispatch = Container.useDispatch()
  const onCancel = () => {
    dispatch(RouteTreeGen.createNavigateUp())
  }
  const onDeleteHistory = () => {
    const conversationIDKey = ownProps.route.params?.conversationIDKey ?? Constants.noConversationIDKey
    dispatch(RouteTreeGen.createClearModals())
    dispatch(Chat2Gen.createMessageDeleteHistory({conversationIDKey}))
  }
  const props = {
    onCancel,
    onDeleteHistory,
  }
  return <DeleteHistoryWarning {...props} />
}
