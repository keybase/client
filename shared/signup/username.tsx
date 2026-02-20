import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import {SignupScreen, errorBanner} from './common'
import {useSignupState} from '@/constants/signup'
import {useProvisionState} from '@/constants/provision'

const ConnectedEnterUsername = () => {
  const error = useSignupState(s => s.usernameError)
  const initialUsername = useSignupState(s => s.username)
  const usernameTaken = useSignupState(s => s.usernameTaken)
  const checkUsername = useSignupState(s => s.dispatch.checkUsername)
  const waiting = C.Waiting.useAnyWaiting(C.waitingKeySignup)
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const restartSignup = useSignupState(s => s.dispatch.restartSignup)
  const onBack = () => {
    restartSignup()
    navigateUp()
  }
  const onContinue = checkUsername

  const startProvision = useProvisionState(s => s.dispatch.startProvision)
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
  const eulaLabel = (
    <Kb.Text type={Kb.Styles.isMobile ? 'BodySmall' : 'Body'} style={{alignSelf: 'center'}}>
      I accept the{' '}
      <Kb.Text
        type={Kb.Styles.isMobile ? 'BodySmallPrimaryLink' : 'BodyPrimaryLink'}
        onClickURL="https://keybase.io/docs/acceptable-use-policy"
      >
        Keybase Acceptable Use Policy
      </Kb.Text>
    </Kb.Text>
  )
  const eulaBlock = (
    <Kb.Checkbox label={eulaLabel} checked={acceptedEULA} onCheck={() => setAcceptedEULA(s => !s)} />
  )
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
      footer={Kb.Styles.isMobile ? eulaBlock : undefined}
      onBack={props.onBack}
      title="Create account"
    >
      <Kb.ScrollView>
        <Kb.Box2
          alignItems="center"
          gap={Kb.Styles.isMobile ? 'small' : 'medium'}
          direction="vertical"
          style={styles.body}
          fullWidth={true}
        >
          <Kb.Avatar size={C.isLargeScreen ? 96 : 64} />
          <Kb.Box2 direction="vertical" fullWidth={Kb.Styles.isPhone} gap="tiny">
            <Kb.LabeledInput
              placeholderInline={true}
              autoFocus={true}
              containerStyle={styles.input}
              placeholder="Pick a username"
              maxLength={C.maxUsernameLength}
              onChangeText={onChangeUsername}
              onEnterKeyDown={onContinue}
            />
            <Kb.Text type="BodySmall">Your username is unique and can not be changed in the future.</Kb.Text>
          </Kb.Box2>
          {!Kb.Styles.isMobile && eulaBlock}
        </Kb.Box2>
      </Kb.ScrollView>
    </SignupScreen>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  body: {
    flex: 1,
  },
  input: Kb.Styles.platformStyles({
    isElectron: {width: 368},
    isTablet: {width: 368},
  }),
}))

export default ConnectedEnterUsername
