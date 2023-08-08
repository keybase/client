import * as RouterConstants from '../../constants/router2'
import * as Constants from '../../constants/chat2'
import type * as Types from '../../constants/types/chat2'
import DeleteHistoryWarning from '.'

type OwnProps = {conversationIDKey: Types.ConversationIDKey}

// props needed by page for injection
export default (_ownProps: OwnProps) => {
  const navigateUp = RouterConstants.useState(s => s.dispatch.navigateUp)
  const onCancel = () => {
    navigateUp()
  }
  const clearModals = RouterConstants.useState(s => s.dispatch.clearModals)
  const messageDeleteHistory = Constants.useContext(s => s.dispatch.messageDeleteHistory)
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
