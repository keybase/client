import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {SignupScreen} from '../common'
import {ButtonType} from '../../common-adapters/button'

type Props = {
  allowSearch: boolean
  error: string
  initialEmail?: string
  onBack?: () => void
  onChangeAllowSearch?: (allow: boolean) => void
  onFinish: (email: string) => void
  onSkip?: () => void
}

// Parts that are commented out allow skipping entering an email, we don't want
// to allow skipping for now. TODO Y2K-57 allow skipping.
const EnterEmail = (props: Props) => {
  const [email, onChangeEmail] = React.useState(props.initialEmail || '')
  const onContinue = () => props.onFinish(email)
  return (
    <SignupScreen
      buttons={[
        {label: 'Continue', onClick: onContinue, type: 'Success'},
        ...(Styles.isMobile ? [] : []), // [{label: 'Skip for now', onClick: props.onSkip, type: 'Dim' as ButtonType}]),
      ]}
      rightActionLabel="Skip"
      onBack={props.onBack}
      // onRightAction={props.onSkip}
      title="Your email address"
    >
      <Kb.Box2 direction="vertical" gap="tiny" gapStart={Styles.isMobile} style={styles.inputBox}>
        <Kb.NewInput
          autoFocus={true}
          containerStyle={styles.input}
          keyboardType="email-address"
          placeholder="Email address"
          onChangeText={onChangeEmail}
          onEnterKeyDown={onContinue}
          textContentType="emailAddress"
          // TODO (DA) there's an issue with editing this causing remounts.
          // Spent some time looking, figure out later.
          value={email}
        />
        {!!props.error && (
          <Kb.Text type="BodySmallError" style={styles.inputSub}>
            {props.error}
          </Kb.Text>
        )}
        {/* TODO hook in to "add an email" settings
          <Kb.Checkbox
          label="Allow friends to find you by this email address"
          checked={props.allowSearch}
          onCheck={props.onChangeAllowSearch}
          style={styles.checkbox}
        /> */}
      </Kb.Box2>
    </SignupScreen>
  )
}

const styles = Styles.styleSheetCreate({
  checkbox: {width: '100%'},
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
  inputSub: {
    marginLeft: 2,
  },
})

export default EnterEmail
