import * as C from '../constants'
import * as Container from '../util/container'
import * as Kb from '../common-adapters'
import * as Platform from '../constants/platform'
import * as React from 'react'
import * as Styles from '../styles'
import {SignupScreen, errorBanner} from './common'

const ConnectedEnterUsername = () => {
  const error = C.useSignupState(s => s.usernameError)
  const initialUsername = C.useSignupState(s => s.username)
  const usernameTaken = C.useSignupState(s => s.usernameTaken)
  const checkUsername = C.useSignupState(s => s.dispatch.checkUsername)
  const waiting = Container.useAnyWaiting(C.signupWaitingKey)
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const restartSignup = C.useSignupState(s => s.dispatch.restartSignup)
  const onBack = () => {
    restartSignup()
    navigateUp()
  }
  const onContinue = checkUsername

  const startProvision = C.useProvisionState(s => s.dispatch.startProvision)
  const onLogin = (initUsername: string) => {
    startProvision(initUsername)
  }
  const props = {
    error,
    initialUsername,
    onBack,
    onContinue,
    onLogin,
    usernameTaken,
    waiting,
  }
  return <EnterUsername {...props} />
}

type Props = {
  error: string
  initialUsername?: string
  onBack: () => void
  onContinue: (username: string) => void
  onLogin: (username: string) => void
  usernameTaken?: string
  waiting: boolean
}

const EnterUsername = (props: Props) => {
  const [username, onChangeUsername] = React.useState(props.initialUsername || '')
  const [acceptedEULA, setAcceptedEULA] = React.useState(false)
  const usernameTrimmed = username.trim()
  const disabled = !usernameTrimmed || usernameTrimmed === props.usernameTaken || !acceptedEULA
  const onContinue = () => {
    if (disabled) {
      return
    }
    onChangeUsername(usernameTrimmed) // maybe trim the input
    props.onContinue(usernameTrimmed)
  }
  return (
    <SignupScreen
      banners={
        <>
          {props.usernameTaken ? (
            <Kb.Banner key="usernameTaken" color="blue">
              <Kb.BannerParagraph
                bannerColor="blue"
                content={[
                  'Sorry, this username is already taken. Did you mean to ',
                  {
                    onClick: () => props.usernameTaken && props.onLogin(props.usernameTaken),
                    text: `log in as ${props.usernameTaken}`,
                  },
                  '?',
                ]}
              />
            </Kb.Banner>
          ) : null}
          {errorBanner(props.error)}
        </>
      }
      buttons={[
        {
          disabled: disabled,
          label: 'Continue',
          onClick: onContinue,
          type: 'Success',
          waiting: props.waiting,
        },
      ]}
      onBack={props.onBack}
      title={Styles.isMobile ? 'Create account' : 'Create an account'}
    >
      <Kb.ScrollView>
        <Kb.Box2
          alignItems="center"
          gap={Styles.isMobile ? 'small' : 'medium'}
          direction="vertical"
          style={styles.body}
          fullWidth={true}
        >
          <Kb.Avatar size={Platform.isLargeScreen ? 96 : 64} />
          <Kb.Box2 direction="vertical" fullWidth={Styles.isPhone} gap="tiny">
            <Kb.LabeledInput
              autoFocus={true}
              containerStyle={styles.input}
              placeholder="Pick a username"
              maxLength={C.maxUsernameLength}
              onChangeText={onChangeUsername}
              onEnterKeyDown={onContinue}
              value={username}
            />
            <Kb.Text type="BodySmall">Your username is unique and can not be changed in the future.</Kb.Text>
          </Kb.Box2>
          <Kb.Box2
            direction={Styles.isMobile ? 'vertical' : 'horizontal'}
            fullWidth={Styles.isPhone}
            gap="tiny"
            alignItems="flex-start"
          >
            <Kb.Checkbox
              label="I accept the Keybase Acceptable Use Policy"
              checked={acceptedEULA}
              onCheck={() => setAcceptedEULA(s => !s)}
            />
            <Kb.Text
              type="BodyPrimaryLink"
              style={{marginTop: 2}}
              onClickURL="https://keybase.io/docs/acceptable-use-policy"
            >
              (Read it here)
            </Kb.Text>
          </Kb.Box2>
        </Kb.Box2>
      </Kb.ScrollView>
    </SignupScreen>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  body: {
    flex: 1,
  },
  input: Styles.platformStyles({
    isElectron: {width: 368},
    isTablet: {width: 368},
  }),
}))

export default ConnectedEnterUsername
