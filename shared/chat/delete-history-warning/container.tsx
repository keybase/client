import * as C from '../../constants'
import type * as Types from '../../constants/types/chat2'
import DeleteHistoryWarning from '.'

type OwnProps = {conversationIDKey: Types.ConversationIDKey}

// props needed by page for injection
export default (_ownProps: OwnProps) => {
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const onCancel = () => {
    navigateUp()
  }
  const clearModals = C.useRouterState(s => s.dispatch.clearModals)
  const messageDeleteHistory = C.useChatContext(s => s.dispatch.messageDeleteHistory)
  const onDeleteHistory = () => {
    clearModals()
    messageDeleteHistory()
  }
  const props = {
    onCancel,
    onDeleteHistory,
  }
  return <DeleteHistoryWarning {...props} />
}
