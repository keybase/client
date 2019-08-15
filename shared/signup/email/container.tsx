import * as React from 'react'
import * as Container from '../../util/container'
import * as SettingsGen from '../../actions/settings-gen'
import * as SettingsConstants from '../../constants/settings'
import * as SignupGen from '../../actions/signup-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import {anyWaiting} from '../../constants/waiting'
import EnterEmail, {Props} from '.'

type OwnProps = {}

type WatcherProps = Props & {
  addedEmail: string | null
  onSuccess: (email: string) => void
}
const WatchForSuccess = (props: WatcherProps) => {
  const [addEmailInProgress, onAddEmailInProgress] = React.useState('')
  React.useEffect(() => {
    if (props.addedEmail === addEmailInProgress) {
      props.onSuccess(addEmailInProgress)
    }
  }, [props.addedEmail, addEmailInProgress])

  const onCreate = (email: string, searchable: boolean) => {
    props.onCreate(email, searchable)
    onAddEmailInProgress(email)
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
    addedEmail: state.settings.email.addedEmail,
    error: state.settings.email.error,
    initialEmail: state.signup.email,
    waiting: anyWaiting(state, SettingsConstants.addEmailWaitingKey),
  }),
  (dispatch: Container.TypedDispatch) => ({
    onCreate: (email: string, searchable: boolean) => {
      dispatch(SettingsGen.createAddEmail({email, searchable}))
    },
    onSkip: () => {
      dispatch(SignupGen.createSetJustSignedUpEmail({email: 'none'}))
      dispatch(RouteTreeGen.createClearModals())
    },
    onSuccess: (email: string) => {
      dispatch(SignupGen.createSetJustSignedUpEmail({email}))
      dispatch(RouteTreeGen.createClearModals())
    },
  }),
  (s, d, o: OwnProps) => ({
    ...s,
    ...d,
    ...o,
  })
)(WatchForSuccess)

export default ConnectedEnterEmail
