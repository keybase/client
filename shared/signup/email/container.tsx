import * as C from '@/constants'
import * as React from 'react'
import * as Constants from '@/constants/signup'
import EnterEmail, {type Props} from '.'

type WatcherProps = Props & {
  addedEmail?: string
  onSuccess: (email: string) => void
}
const WatchForSuccess = (props: WatcherProps) => {
  const {addedEmail, onSuccess} = props
  const [addEmailInProgress, setAddEmailInProgress] = React.useState('')
  React.useEffect(() => {
    if (addedEmail === addEmailInProgress) {
      onSuccess(addEmailInProgress)
    }
  }, [addedEmail, addEmailInProgress, onSuccess])

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
  const _showPushPrompt = C.usePushState(s => C.isMobile && !s.hasPermissions && s.showPushPrompt)
  const addedEmail = C.useSettingsEmailState(s => s.addedEmail)
  const error = C.useSettingsEmailState(s => s.error)
  const initialEmail = C.useSignupState(s => s.email)
  const waiting = C.Waiting.useAnyWaiting(C.addEmailWaitingKey)
  const clearModals = C.useRouterState(s => s.dispatch.clearModals)
  const _navClearModals = () => {
    clearModals()
  }
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const _navToPushPrompt = () => {
    navigateAppend('settingsPushPrompt', true)
  }

  const setJustSignedUpEmail = C.useSignupState(s => s.dispatch.setJustSignedUpEmail)
  const _onSkip = () => {
    setJustSignedUpEmail(Constants.noEmail)
  }
  const _onSuccess = setJustSignedUpEmail

  const addEmail = C.useSettingsEmailState(s => s.dispatch.addEmail)
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
