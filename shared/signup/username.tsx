import * as Constants from '../constants/signup'
import * as Container from '../util/container'
import * as Kb from '../common-adapters'
import * as Platform from '../constants/platform'
import * as ProvisionGen from '../actions/provision-gen'
import * as React from 'react'
import * as RouteTreeGen from '../actions/route-tree-gen'
import * as SignupGen from '../actions/signup-gen'
import * as Styles from '../styles'
import {InfoIcon, SignupScreen, errorBanner} from './common'
import {anyWaiting} from '../constants/waiting'
import {maxUsernameLength} from '../constants/signup'

const ConnectedEnterUsername = () => {
  const error = Container.useSelector(state => state.signup.usernameError)
  const initialUsername = Container.useSelector(state => state.signup.username)
  const usernameTaken = Container.useSelector(state => state.signup.usernameTaken)
  const waiting = Container.useSelector(state => anyWaiting(state, Constants.waitingKey))
  const dispatch = Container.useDispatch()
  const onBack = () => {
    dispatch(SignupGen.createRestartSignup())
    dispatch(RouteTreeGen.createNavigateUp())
  }
  const onContinue = (username: string) => {
    dispatch(SignupGen.createCheckUsername({username}))
  }
  const onLogin = (initUsername: string) => {
    dispatch(ProvisionGen.createStartProvision({initUsername}))
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

export default ConnectedEnterUsername

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
  const usernameTrimmed = username.trim()
  const disabled = !usernameTrimmed || usernameTrimmed === props.usernameTaken
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
            maxLength={maxUsernameLength}
            onChangeText={onChangeUsername}
            onEnterKeyDown={onContinue}
            value={username}
          />
          <Kb.Text type="BodySmall">Your username is unique and can not be changed in the future.</Kb.Text>
        </Kb.Box2>
      </Kb.Box2>
    </SignupScreen>
  )
}

export const options = {
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

const styles = Styles.styleSheetCreate(() => ({
  body: {
    flex: 1,
  },
  input: Styles.platformStyles({
    isElectron: {width: 368},
    isTablet: {width: 368},
  }),
}))
