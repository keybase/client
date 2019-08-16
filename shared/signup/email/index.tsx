import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
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
  const disabled = !email
  const onContinue = () => (disabled ? {} : props.onCreate(email, searchable))

  return (
    <SignupScreen
      banners={errorBanner(props.error)}
      buttons={[
        {
          disabled: disabled || props.waiting,
          label: 'Finish',
          onClick: onContinue,
          type: 'Success',
        },
        ...(!Styles.isMobile && props.onSkip
          ? [
              {
                disabled: props.waiting,
                label: 'Skip for now',
                onClick: props.onSkip,
                type: 'Dim' as const,
              },
            ]
          : []),
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
        icon={Styles.isMobile ? <Kb.Icon type="icon-email-add-96" style={styles.icon} /> : null}
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
  icon: React.ReactNode
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
