import * as React from 'react'
import * as Container from '../../util/container'
import * as SettingsGen from '../../actions/settings-gen'
import * as SettingsConstants from '../../constants/settings'
import * as SignupGen from '../../actions/signup-gen'
import * as SignupConstants from '../../constants/signup'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Platform from '../../constants/platform'
import EnterEmail, {type Props} from '.'

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

const ConnectedEnterEmail = () => {
  const _showPushPrompt = Container.useSelector(
    state => Platform.isMobile && !state.push.hasPermissions && state.push.showPushPrompt
  )
  const addedEmail = Container.useSelector(state => state.settings.email.addedEmail)
  const error = Container.useSelector(state => state.settings.email.error || '')
  const initialEmail = Container.useSelector(state => state.signup.email)
  const waiting = Container.useAnyWaiting(SettingsConstants.addEmailWaitingKey)
  const dispatch = Container.useDispatch()
  const _navClearModals = () => {
    dispatch(RouteTreeGen.createClearModals())
  }
  const _navToPushPrompt = () => {
    dispatch(RouteTreeGen.createNavigateAppend({path: ['settingsPushPrompt'], replace: true}))
  }
  const _onSkip = () => {
    dispatch(SignupGen.createSetJustSignedUpEmail({email: SignupConstants.noEmail}))
  }
  const _onSuccess = (email: string) => {
    dispatch(SignupGen.createSetJustSignedUpEmail({email}))
  }
  const onCreate = (email: string, searchable: boolean) => {
    dispatch(SettingsGen.createAddEmail({email, searchable}))
  }
  const props = {
    addedEmail: addedEmail,
    error: error,
    initialEmail: initialEmail,
    onCreate: onCreate,
    onSkip: () => {
      _onSkip()
      _showPushPrompt ? _navToPushPrompt() : _navClearModals()
    },
    onSuccess: (email: string) => {
      _onSuccess(email)
      _showPushPrompt ? _navToPushPrompt() : _navClearModals()
    },
    waiting: waiting,
  }
  return <WatchForSuccess {...props} />
}

export default ConnectedEnterEmail
