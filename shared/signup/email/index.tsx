import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {InfoIcon, SignupScreen, errorBanner} from '../common'

type Props = {
  error: string
  initialEmail?: string
  onBack?: () => void
  onFinish: (email: string, allowSearch: boolean) => void
  onSkip?: () => void
}
// Parts that are commented out allow skipping entering an email, we don't want
// to allow skipping for now. TODO Y2K-57 allow skipping.
const EnterEmail = (props: Props) => {
  const [email, onChangeEmail] = React.useState(props.initialEmail || '')
  const [allowSearch, onChangeAllowSearch] = React.useState(true)
  const disabled = !email
  const onContinue = () => (disabled ? {} : props.onFinish(email, allowSearch))
  return (
    <SignupScreen
      banners={errorBanner(props.error)}
      buttons={[
        {disabled, label: 'Continue', onClick: onContinue, type: 'Success'},
        ...(Styles.isMobile ? [] : []), // [{label: 'Skip for now', onClick: props.onSkip, type: 'Dim' as ButtonType}]),
      ]}
      rightActionLabel="Skip"
      onBack={props.onBack}
      // onRightAction={props.onSkip}
      title="Your email address"
    >
      <EnterEmailBody
        onChangeEmail={onChangeEmail}
        onContinue={onContinue}
        email={email}
        showAllowSearch={true}
        allowSearch={allowSearch}
        onChangeAllowSearch={onChangeAllowSearch}
        icon={Styles.isMobile ? <Kb.Icon type="icon-email-add-96" style={styles.icon} /> : null}
      />
    </SignupScreen>
  )
}

EnterEmail.navigationOptions = {
  header: null,
  headerBottomStyle: {height: undefined},
  headerLeft: null, // no back button
  headerRightActions: () => (
    <Kb.Box2
      direction="horizontal"
      style={Styles.padding(Styles.globalMargins.tiny, Styles.globalMargins.tiny, 0)}
    >
      <InfoIcon />
    </Kb.Box2>
  ),
}

type BodyProps = {
  onChangeEmail: (email: string) => void
  onContinue: () => void
  email: string
  allowSearch: boolean
  onChangeAllowSearch: (allow: boolean) => void
  showAllowSearch: boolean
  icon: React.ReactNode
}
export const EnterEmailBody = (props: BodyProps) => (
  <Kb.Box2
    alignItems="center"
    direction="vertical"
    gap={Styles.isMobile ? 'small' : 'medium'}
    fullWidth={true}
    style={Styles.globalStyles.flexOne}
  >
    {props.icon}
    <Kb.Box2 direction="vertical" gap="tiny" gapStart={Styles.isMobile} style={styles.inputBox}>
      <Kb.NewInput
        autoFocus={true}
        containerStyle={styles.input}
        keyboardType="email-address"
        placeholder="Email address"
        onChangeText={props.onChangeEmail}
        onEnterKeyDown={props.onContinue}
        textContentType="emailAddress"
        value={props.email}
      />
      {props.showAllowSearch && (
        <Kb.Checkbox
          label="Allow friends to find you by this email address"
          checked={props.allowSearch}
          onCheck={props.onChangeAllowSearch}
          style={styles.checkbox}
        />
      )}
    </Kb.Box2>
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate({
  checkbox: {width: '100%'},
  icon: {
    height: 96,
    width: 96,
  },
  input: Styles.platformStyles({
    common: {},
    isElectron: {
      ...Styles.padding(0, Styles.globalMargins.xsmall),
      height: 38,
      width: 368,
    },
    isMobile: {
      ...Styles.padding(0, Styles.globalMargins.small),
      height: 48,
    },
  }),
  inputBox: Styles.platformStyles({
    isElectron: {
      // need to set width so subtext will wrap
      width: 368,
    },
  }),
})

export default EnterEmail
