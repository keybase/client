import * as C from '@/constants'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import {SignupScreen, errorBanner} from './common'
import {useSettingsEmailState} from '@/stores/settings-email'
import {useSignupState} from '@/stores/signup'
import {usePushState} from '@/stores/push'

const ConnectedEnterEmail = () => {
  const _showPushPrompt = usePushState(s => C.isMobile && !s.hasPermissions && s.showPushPrompt)
  const addedEmail = useSettingsEmailState(s => s.addedEmail)
  const error = useSettingsEmailState(s => s.error)
  const initialEmail = useSignupState(s => s.email)
  const waiting = C.Waiting.useAnyWaiting(C.addEmailWaitingKey)
  const clearModals = C.useRouterState(s => s.dispatch.clearModals)
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const _navToPushPrompt = React.useCallback(() => {
    navigateAppend('settingsPushPrompt', true)
  }, [navigateAppend])

  const setJustSignedUpEmail = useSignupState(s => s.dispatch.setJustSignedUpEmail)
  const _onSkip = () => {
    setJustSignedUpEmail(C.noEmail)
  }
  const _onSuccess = setJustSignedUpEmail

  const addEmail = useSettingsEmailState(s => s.dispatch.addEmail)
  const onSkip = () => {
    _onSkip()
    _showPushPrompt ? _navToPushPrompt() : clearModals()
  }
  const onSuccess = React.useCallback(
    (email: string) => {
      _onSuccess(email)
      _showPushPrompt ? _navToPushPrompt() : clearModals()
    },
    [_onSuccess, _showPushPrompt, _navToPushPrompt, clearModals]
  )
  const [addEmailInProgress, setAddEmailInProgress] = React.useState('')
  React.useEffect(() => {
    if (addedEmail === addEmailInProgress) {
      onSuccess(addEmailInProgress)
    }
  }, [addedEmail, addEmailInProgress, onSuccess])

  const onCreate = (email: string, searchable: boolean) => {
    addEmail(email, searchable)
    setAddEmailInProgress(email)
  }

  const [email, onChangeEmail] = React.useState(initialEmail || '')
  const [searchable, onChangeSearchable] = React.useState(true)
  const disabled = !email.trim()
  const onContinue = () => (disabled ? {} : onCreate(email.trim(), searchable))

  return (
    <SignupScreen
      banners={errorBanner(error)}
      buttons={[
        {
          disabled,
          label: 'Finish',
          onClick: onContinue,
          type: 'Success',
          waiting: waiting,
        },
      ]}
      rightActionLabel="Skip"
      onRightAction={onSkip}
      title="Your email address"
      showHeaderInfoicon={true}
    >
      <EnterEmailBody
        onChangeEmail={onChangeEmail}
        onContinue={onContinue}
        email={email}
        showSearchable={true}
        searchable={searchable}
        onChangeSearchable={onChangeSearchable}
        iconType={C.isLargeScreen ? 'icon-email-add-96' : 'icon-email-add-64'}
      />
    </SignupScreen>
  )
}

export type Props = {
  error: string
  initialEmail: string
  onCreate: (email: string, searchable: boolean) => void
  onSkip?: () => void
  waiting: boolean
}

type BodyProps = {
  onChangeEmail: (email: string) => void
  onContinue: () => void
  email: string
  searchable: boolean
  onChangeSearchable: (allow: boolean) => void
  showSearchable: boolean
  iconType: Kb.IconType
}
export const EnterEmailBody = (props: BodyProps) => (
  <Kb.ScrollView>
    <Kb.Box2
      alignItems="center"
      direction="vertical"
      gap={Kb.Styles.isMobile ? 'small' : 'medium'}
      fullWidth={true}
      style={Kb.Styles.globalStyles.flexOne}
    >
      <Kb.Icon type={props.iconType} />
      <Kb.Box2 direction="vertical" gap="tiny" style={styles.inputBox}>
        <Kb.LabeledInput
          autoFocus={true}
          containerStyle={styles.input}
          keyboardType="email-address"
          placeholder="Email address"
          onChangeText={props.onChangeEmail}
          onEnterKeyDown={props.onContinue}
          textContentType="emailAddress"
          value={props.email}
        />
        {props.showSearchable && (
          <Kb.Checkbox
            label="Allow friends to find you by this email address"
            checked={props.searchable}
            onCheck={props.onChangeSearchable}
            style={styles.checkbox}
          />
        )}
      </Kb.Box2>
    </Kb.Box2>
  </Kb.ScrollView>
)

const styles = Kb.Styles.styleSheetCreate(() => ({
  checkbox: {width: '100%'},
  input: Kb.Styles.platformStyles({
    isElectron: {width: 368},
  }),
  inputBox: Kb.Styles.platformStyles({
    // need to set width so subtext will wrap
    isElectron: {width: 368},
    isMobile: {width: '100%'},
  }),
}))

export default ConnectedEnterEmail
