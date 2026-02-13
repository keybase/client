import * as C from '@/constants'
import Feedback from '.'
import type {Props} from './container'
import {useSendFeedback} from './shared'
import {useConfigState} from '@/stores/config'

const Container = (ownProps: Props) => {
  const {sendFeedback, error} = useSendFeedback()
  const feedback = ownProps.feedback ?? ''
  const loggedOut = useConfigState(s => !s.loggedIn)
  const sending = C.Waiting.useAnyWaiting(C.waitingKeySettingsSendFeedback)
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const onBack = () => {
    navigateUp()
  }
  const onSendFeedback = sendFeedback
  const props = {
    feedback,
    loggedOut,
    onBack,
    onFeedbackDone: () => null,
    onSendFeedback,
    sendError: error,
    sending,
    showInternalSuccessBanner: true,
  }
  return <Feedback {...props} />
}

export default Container
