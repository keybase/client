import * as Constants from '../constants/settings'
import * as Container from '../util/container'
import * as Kb from '../common-adapters'
import * as React from 'react'
import * as RouteTreeGen from '../actions/route-tree-gen'
import * as SettingsGen from '../actions/settings-gen'
import FeedbackForm from '../settings/feedback/index'
import {SignupScreen, errorBanner} from './common'
import {anyWaiting} from '../constants/waiting'

export default () => {
  const loggedOut = Container.useSelector(state => !state.config.loggedIn)
  const sendError = Container.useSelector(state => state.settings.feedback.error)
  const sending = Container.useSelector(state => anyWaiting(state, Constants.sendFeedbackWaitingKey))

  const dispatch = Container.useDispatch()
  const onBack = () => {
    dispatch(RouteTreeGen.createNavigateUp())
  }
  const onSendFeedback = (feedback: string, sendLogs: boolean, sendMaxBytes: boolean) => {
    dispatch(SettingsGen.createSendFeedback({feedback, sendLogs, sendMaxBytes}))
  }
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
  sendError?: Error
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
export const options = {
  headerBottomStyle: {height: undefined},
  headerLeft: null,
  headerRightActions: null,
}
