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
          ? [
              <Kb.Banner key="feedbackSent" color="green">
                <Kb.BannerParagraph bannerColor="green" content="Thanks! Your feedback was sent." />
              </Kb.Banner>,
            ]
          : []),
        ...(props.sendError ? errorBanner(props.sendError.message) : []),
      ]}
      title="Send feedback"
      onBack={!props.loggedOut ? props.onBack : undefined}
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
SendFeedback.navigationOptions = {
  header: null,
  headerBottomStyle: {height: undefined},
  headerRightActions: null,
}

export default SendFeedback
