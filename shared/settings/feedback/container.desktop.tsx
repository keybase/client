import * as C from '@/constants'
import Feedback from '.'
import {useSendFeedback} from '@/settings/feedback/shared'
import {useConfigState} from '@/stores/config'
import type {Props} from '@/settings/feedback/container.shared'
const Container = (ownProps: Props) => {
  const {sendFeedback, error} = useSendFeedback()
  const feedback = ownProps.feedback ?? ''
  const loggedOut = useConfigState(s => !s.loggedIn)
  const sending = C.Waiting.useAnyWaiting(C.waitingKeySettingsSendFeedback)
  const navigateUp = C.Router2.navigateUp
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

export type * from '@/settings/feedback/container.shared'
