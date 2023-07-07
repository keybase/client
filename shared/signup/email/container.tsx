import * as React from 'react'
import * as Container from '../../util/container'
import * as SettingsConstants from '../../constants/settings'
import * as Constants from '../../constants/signup'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Platform from '../../constants/platform'
import * as PushConstants from '../../constants/push'
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
  const _showPushPrompt = PushConstants.useState(
    s => Platform.isMobile && !s.hasPermissions && s.showPushPrompt
  )
  const addedEmail = SettingsConstants.useEmailState(s => s.addedEmail)
  const error = SettingsConstants.useEmailState(s => s.error)
  const initialEmail = Constants.useState(s => s.email)
  const waiting = Container.useAnyWaiting(SettingsConstants.addEmailWaitingKey)
  const dispatch = Container.useDispatch()
  const _navClearModals = () => {
    dispatch(RouteTreeGen.createClearModals())
  }
  const _navToPushPrompt = () => {
    dispatch(RouteTreeGen.createNavigateAppend({path: ['settingsPushPrompt'], replace: true}))
  }

  const setJustSignedUpEmail = Constants.useState(s => s.dispatch.setJustSignedUpEmail)
  const _onSkip = () => {
    setJustSignedUpEmail(Constants.noEmail)
  }
  const _onSuccess = setJustSignedUpEmail

  const addEmail = SettingsConstants.useEmailState(s => s.dispatch.addEmail)
  const onCreate = addEmail
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
