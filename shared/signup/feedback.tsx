import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import FeedbackForm from '../settings/feedback/index'
import {SignupScreen, errorBanner} from './common'
import {useSendFeedback} from '../settings/feedback/shared'
import {useConfigState} from '@/stores/config'

const SignupFeedback = () => {
  const {error: sendError, sendFeedback: onSendFeedback} = useSendFeedback()
  const loggedOut = useConfigState(s => !s.loggedIn)
  const sending = C.Waiting.useAnyWaiting(C.waitingKeySettingsSendFeedback)
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const onBack = () => {
    navigateUp()
  }
  const [feedbackSent, setFeedbackSent] = React.useState(false)

  return (
    <SignupScreen
      banners={
        <>
          {feedbackSent ? (
            <Kb.Banner key="feedbackSent" color="green">
              <Kb.BannerParagraph bannerColor="green" content="Thanks! Your feedback was sent." />
            </Kb.Banner>
          ) : null}
          {sendError ? errorBanner(sendError) : null}
        </>
      }
      title="Send feedback"
      onBack={onBack}
      showHeaderInfoicon={false}
      showHeaderInfoiconRow={!loggedOut}
    >
      <FeedbackForm
        sendError=""
        loggedOut={loggedOut}
        sending={sending}
        onSendFeedback={onSendFeedback}
        showInternalSuccessBanner={false}
        onFeedbackDone={state => setFeedbackSent(!sendError && state)}
      />
    </SignupScreen>
  )
}

export default SignupFeedback
