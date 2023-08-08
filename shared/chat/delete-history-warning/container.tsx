import * as RouterConstants from '../../constants/router2'
import * as Constants from '../../constants/chat2'
import DeleteHistoryWarning from '.'

export default () => {
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
