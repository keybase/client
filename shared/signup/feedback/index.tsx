import * as React from 'react'
import * as Kb from '../../common-adapters'
import {SignupScreen, errorBanner} from '../common'
import FeedbackForm from '../../settings/feedback/index'

type Props = {
  loggedOut: boolean
  onBack: () => void
  onSendFeedback: (feedback: string, sendLogs: boolean, sendMaxBytes: boolean) => void
  sending: boolean
  sendError: Error | null
}

const SendFeedback = (props: Props) => {
  const [feedbackSent, setFeedbackSent] = React.useState(false)

  return (
    <SignupScreen
      buttons={[]}
      banners={[
        ...(feedbackSent
          ? [<Kb.Banner key="feedbackSent" text="Thanks! Your feedback was sent." color="green" />]
          : []),
        ...(props.sendError ? errorBanner(props.sendError.message) : []),
      ]}
      title="Send feedback"
      onBack={!props.loggedOut ? props.onBack : null}
      showHeaderInfoicon={false}
      showHeaderInfoiconRow={!props.loggedOut}
    >
      <FeedbackForm
        loggedOut={props.loggedOut}
        sendError={null} // nulled out on purpose so that we handle the error
        sending={props.sending}
        onSendFeedback={props.onSendFeedback}
        showInternalSuccessBanner={false}
        onFeedbackDone={state => setFeedbackSent(!props.sendError && state)}
      />
    </SignupScreen>
  )
}

export default SendFeedback
