import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Platform from '../../constants/platform'
import {maxUsernameLength} from '../../constants/signup'
import {InfoIcon, SignupScreen, errorBanner} from '../common'

type Props = {
  error: string
  initialUsername?: string
  onBack: () => void
  onContinue: (username: string) => void
  onLogin: (username: string) => void
  usernameTaken: string | null
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

EnterUsername.navigationOptions = {
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

export default EnterUsername
