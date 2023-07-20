import * as Chat2Gen from '../../actions/chat2-gen'
import * as RouterConstants from '../../constants/router2'
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
  const clearModals = RouterConstants.useState(s => s.dispatch.clearModals)
  const onDeleteHistory = () => {
    clearModals()
    dispatch(Chat2Gen.createMessageDeleteHistory({conversationIDKey}))
  }
  const props = {
    onCancel,
    onDeleteHistory,
  }
  return <DeleteHistoryWarning {...props} />
}
