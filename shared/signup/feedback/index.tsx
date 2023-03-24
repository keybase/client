import * as React from 'react'
import * as Kb from '../../common-adapters'
import {SignupScreen, errorBanner} from '../common'
import FeedbackForm from '../../settings/feedback/index'

type Props = {
  loggedOut: boolean
  onBack: () => void
  onSendFeedback: (feedback: string, sendLogs: boolean, sendMaxBytes: boolean) => void
  sending: boolean
  sendError?: Error
}

const SendFeedback = (props: Props) => {
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
          {props.sendError ? errorBanner(props.sendError.message) : null}
        </>
      }
      title="Send feedback"
      onBack={props.onBack}
      showHeaderInfoicon={false}
      showHeaderInfoiconRow={!props.loggedOut}
    >
      <FeedbackForm
        loggedOut={props.loggedOut}
        sending={props.sending}
        onSendFeedback={props.onSendFeedback}
        showInternalSuccessBanner={false}
        onFeedbackDone={state => setFeedbackSent(!props.sendError && state)}
      />
    </SignupScreen>
  )
}
SendFeedback.navigationOptions = {
  headerBottomStyle: {height: undefined},
  headerLeft: null,
  headerRightActions: null,
}

export default SendFeedback
