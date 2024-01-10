import * as C from '@/constants'
import * as Constants from '@/constants/settings'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import FeedbackForm from '../settings/feedback/index'
import {SignupScreen, errorBanner} from './common'
import {useSendFeedback} from '../settings/feedback/shared'

const Container = () => {
  const {error, sendFeedback} = useSendFeedback()
  const loggedOut = C.useConfigState(s => !s.loggedIn)
  const sendError = error
  const sending = C.Waiting.useAnyWaiting(Constants.sendFeedbackWaitingKey)
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const onBack = () => {
    navigateUp()
  }
  const onSendFeedback = sendFeedback
  const props = {
    loggedOut,
    onBack,
    onSendFeedback,
    sendError,
    sending,
  }
  return <SignupFeedback {...props} />
}

type Props = {
  loggedOut: boolean
  onBack: () => void
  onSendFeedback: (feedback: string, sendLogs: boolean, sendMaxBytes: boolean) => void
  sending: boolean
  sendError: string
}

const SignupFeedback = (props: Props) => {
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
          {props.sendError ? errorBanner(props.sendError) : null}
        </>
      }
      title="Send feedback"
      onBack={props.onBack}
      showHeaderInfoicon={false}
      showHeaderInfoiconRow={!props.loggedOut}
    >
      <FeedbackForm
        sendError=""
        loggedOut={props.loggedOut}
        sending={props.sending}
        onSendFeedback={props.onSendFeedback}
        showInternalSuccessBanner={false}
        onFeedbackDone={state => setFeedbackSent(!props.sendError && state)}
      />
    </SignupScreen>
  )
}

export default Container
