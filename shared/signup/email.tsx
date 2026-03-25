import * as C from '@/constants'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import {SignupScreen, errorBanner} from './common'
import {useSettingsEmailState} from '@/stores/settings-email'
import {useSignupState} from '@/stores/signup'
import {useCompleteSignupWithEmail, useSkipSignupEmail} from './navigation'

const ConnectedEnterEmail = () => {
  const {addEmail, addedEmail, error} = useSettingsEmailState(
    C.useShallow(s => ({
      addEmail: s.dispatch.addEmail,
      addedEmail: s.addedEmail,
      error: s.error,
    }))
  )
  const initialEmail = useSignupState(s => s.email)
  const waiting = C.Waiting.useAnyWaiting(C.addEmailWaitingKey)
  const onSkip = useSkipSignupEmail()
  const onCompleteSignupWithEmail = useCompleteSignupWithEmail()

  const [addEmailInProgress, setAddEmailInProgress] = React.useState('')
  React.useEffect(() => {
    if (addEmailInProgress && addedEmail === addEmailInProgress) {
      onCompleteSignupWithEmail(addedEmail)
    }
  }, [addedEmail, addEmailInProgress, onCompleteSignupWithEmail])

  const onCreate = (email: string, searchable: boolean) => {
    addEmail(email, searchable)
    setAddEmailInProgress(email)
  }

  const [email, onChangeEmail] = React.useState(initialEmail || '')
  const [searchable, onChangeSearchable] = React.useState(true)
  const emailTrimmed = email.trim()
  const disabled = !emailTrimmed
  const onContinue = () => {
    if (disabled) {
      return
    }

    onCreate(emailTrimmed, searchable)
  }

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
      showHeaderInfoIcon={true}
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
      <Kb.ImageIcon type={props.iconType} />
      <Kb.Box2 direction="vertical" gap="tiny" style={styles.inputBox}>
        <Kb.Input3
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
