import * as C from '../../constants'
import type * as T from '../../constants/types'
import DeleteHistoryWarning from '.'

type OwnProps = {
  conversationIDKey: T.Chat.ConversationIDKey // for page
}

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
