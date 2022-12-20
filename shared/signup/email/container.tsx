import * as React from 'react'
import * as Container from '../../util/container'
import * as SettingsGen from '../../actions/settings-gen'
import * as SettingsConstants from '../../constants/settings'
import * as SignupGen from '../../actions/signup-gen'
import * as SignupConstants from '../../constants/signup'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Platform from '../../constants/platform'
import {anyWaiting} from '../../constants/waiting'
import EnterEmail, {type Props} from '.'

type OwnProps = {}

type WatcherProps = Props & {
  addedEmail?: string
  onSuccess: (email: string) => void
}
const WatchForSuccess = (props: WatcherProps) => {
  const [addEmailInProgress, setAddEmailInProgress] = React.useState('')
  React.useEffect(() => {
    if (props.addedEmail === addEmailInProgress) {
      props.onSuccess(addEmailInProgress)
    }
  }, [props.addedEmail, addEmailInProgress, props])

  const onCreate = (email: string, searchable: boolean) => {
    props.onCreate(email, searchable)
    setAddEmailInProgress(email)
  }

  return (
    <EnterEmail
      error={props.error}
      initialEmail={props.initialEmail}
      onCreate={onCreate}
      onSkip={props.onSkip}
      waiting={props.waiting}
    />
  )
}

const ConnectedEnterEmail = Container.connect(
  (state: Container.TypedState) => ({
    _showPushPrompt: Platform.isMobile && !state.push.hasPermissions && state.push.showPushPrompt,
    addedEmail: state.settings.email.addedEmail,
    error: state.settings.email.error || '',
    initialEmail: state.signup.email,
    waiting: anyWaiting(state, SettingsConstants.addEmailWaitingKey),
  }),
  (dispatch: Container.TypedDispatch) => ({
    _navClearModals: () => dispatch(RouteTreeGen.createClearModals()),
    _navToPushPrompt: () =>
      dispatch(
        RouteTreeGen.createNavigateAppend({
          path: ['settingsPushPrompt'],
          replace: true,
        })
      ),
    _onSkip: () => dispatch(SignupGen.createSetJustSignedUpEmail({email: SignupConstants.noEmail})),
    _onSuccess: (email: string) => dispatch(SignupGen.createSetJustSignedUpEmail({email})),
    onCreate: (email: string, searchable: boolean) => {
      dispatch(SettingsGen.createAddEmail({email, searchable}))
    },
  }),
  (s, d, o: OwnProps) => ({
    addedEmail: s.addedEmail,
    error: s.error,
    initialEmail: s.initialEmail,
    onCreate: d.onCreate,
    onSkip: () => {
      d._onSkip()
      s._showPushPrompt ? d._navToPushPrompt() : d._navClearModals()
    },
    onSuccess: (email: string) => {
      d._onSuccess(email)
      s._showPushPrompt ? d._navToPushPrompt() : d._navClearModals()
    },
    waiting: s.waiting,
    ...o,
  })
)(WatchForSuccess)

export default ConnectedEnterEmail
