import * as Chat2Gen from '../../actions/chat2-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Container from '../../util/container'
import type * as Types from '../../constants/types/chat2'
import DeleteHistoryWarning from '.'

type OwnProps = {conversationIDKey: Types.ConversationIDKey}

export default (ownProps: OwnProps) => {
  const conversationIDKey = ownProps.conversationIDKey
  const dispatch = Container.useDispatch()
  const onCancel = () => {
    dispatch(RouteTreeGen.createNavigateUp())
  }
  const onDeleteHistory = () => {
    dispatch(RouteTreeGen.createClearModals())
    dispatch(Chat2Gen.createMessageDeleteHistory({conversationIDKey}))
  }
  const props = {
    onCancel,
    onDeleteHistory,
  }
  return <DeleteHistoryWarning {...props} />
}
