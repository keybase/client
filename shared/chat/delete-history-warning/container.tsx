import * as C from '@/constants'
import DeleteHistoryWarning from '.'

const Container = () => {
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
export default Container
