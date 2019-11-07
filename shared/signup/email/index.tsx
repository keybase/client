import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Platform from '../../constants/platform'
import {SignupScreen, errorBanner} from '../common'

export type Props = {
  error: string
  initialEmail: string
  onCreate: (email: string, searchable: boolean) => void
  onSkip?: () => void
  waiting: boolean
}

const EnterEmail = (props: Props) => {
  const [email, onChangeEmail] = React.useState(props.initialEmail || '')
  const [searchable, onChangeSearchable] = React.useState(true)
  const disabled = !email.trim()
  const onContinue = () => (disabled ? {} : props.onCreate(email.trim(), searchable))

  return (
    <SignupScreen
      banners={errorBanner(props.error)}
      buttons={[
        {
          disabled,
          label: 'Finish',
          onClick: onContinue,
          type: 'Success',
          waiting: props.waiting,
        },
      ]}
      rightActionLabel="Skip"
      onRightAction={props.onSkip}
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
        iconType={Platform.isLargeScreen ? 'icon-email-add-96' : 'icon-email-add-64'}
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
      gap={Styles.isMobile ? 'small' : 'medium'}
      fullWidth={true}
      style={Styles.globalStyles.flexOne}
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

const styles = Styles.styleSheetCreate(() => ({
  checkbox: {width: '100%'},
  input: Styles.platformStyles({
    isElectron: {
      width: 368,
    },
  }),
  inputBox: Styles.platformStyles({
    isElectron: {
      // need to set width so subtext will wrap
      width: 368,
    },
    isMobile: {
      width: '100%',
    },
  }),
}))

export default EnterEmail
