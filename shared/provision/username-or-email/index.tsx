import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {maxUsernameLength} from '../../constants/signup'
import {SignupScreen, errorBanner} from '../../signup/common'

type Props = {
  error: string
  initialUsername: string
  inlineError: string
  inlineSignUpLink: boolean
  onBack: () => void
  onForgotUsername: () => void
  onGoToSignup: () => void
  onSubmit: (username: string) => void
  submittedUsername: string
  waiting: boolean
}

/*
  const InlineError = (props: {onGoToSignup: (() => void) | null; error: string}) => (
    <Kb.Box2 direction="vertical" centerChildren={true}>
      <Kb.Text type="BodySmallError" style={styles.error}>
        {props.error}
      </Kb.Text>
      {!!props.onGoToSignup && (
        <Kb.Text onClick={props.onGoToSignup} style={styles.errorLink} type="BodySmallPrimaryLink">
          Sign up for a new account?
        </Kb.Text>
      )}
    </Kb.Box2>
  )
*/

const Username = (props: Props) => {
  const [username, setUsername] = React.useState(props.initialUsername)
  const onSubmit = React.useCallback(() => {
    props.onSubmit(username)
  }, [props.onSubmit, username])

  /*
    let errorTextComponent
    if (props.submittedUsername === username && !!props.inlineError) {
      errorTextComponent = (
        <InlineError
          error={props.inlineError}
          onGoToSignup={props.inlineSignUpLink ? props.onGoToSignup : null}
        />
      )
    }
  */

  /*
    errorText={props.submittedUsername === username ? props.error : ''}
    errorTextComponent={errorTextComponent}
  */

  return (
    <SignupScreen
      banners={[
        ...errorBanner(props.error),
        ...(props.inlineSignUpLink
          ? [
              <Kb.Banner key="usernameTaken" color="blue">
                <Kb.BannerParagraph
                  bannerColor="blue"
                  content={[
                    "This username doesn't exist. Did you mean to ",
                    {
                      onClick: () => props.inlineSignUpLink && props.onGoToSignup(),
                      text: 'create a new account',
                    },
                    '?',
                  ]}
                />
              </Kb.Banner>,
            ]
          : []),
      ]}
      buttons={[
        {
          disabled: !username,
          label: 'Log in',
          onClick: onSubmit,
          type: 'Default',
          waiting: props.waiting,
        },
      ]}
      onBack={props.onBack}
      title="Log in"
      rightActionComponent={
        <Kb.Button type="Default" mode="Secondary" label="Create an account" onClick={props.onGoToSignup} />
      }
    >
      <Kb.UserCard
        style={styles.card}
        outerStyle={styles.outerCard}
        lighterPlaceholders={true}
        avatarSize={96}
      >
        <Kb.Box2 direction="vertical" style={styles.wrapper} gap="xsmall">
          <Kb.LabeledInput
            autoFocus={true}
            placeholder="Username"
            maxLength={maxUsernameLength}
            onEnterKeyDown={onSubmit}
            onChangeText={setUsername}
            value={username}
            textType="BodySemibold"
          />
          <Kb.Text
            style={styles.forgotUsername}
            type="BodySmallSecondaryLink"
            onClick={props.onForgotUsername}
          >
            Forgot username?
          </Kb.Text>
        </Kb.Box2>
      </Kb.UserCard>
    </SignupScreen>
  )
}

const styles = Styles.styleSheetCreate({
  button: Styles.platformStyles({
    common: {
      alignSelf: 'center',
      width: '100%',
    },
    isElectron: {
      marginTop: Styles.globalMargins.medium,
    },
  }),
  card: {
    alignItems: 'stretch',
    backgroundColor: Styles.globalColors.transparent,
  },
  error: {paddingTop: Styles.globalMargins.tiny, textAlign: 'center'},
  errorLink: {
    color: Styles.globalColors.redDark,
    textDecorationLine: 'underline',
  },
  forgotUsername: {
    alignSelf: 'flex-end',
  },
  input: Styles.platformStyles({
    common: {
      backgroundColor: Styles.globalColors.transparent,
      padding: Styles.globalMargins.tiny,
      paddingLeft: Styles.globalMargins.xsmall,
      paddingRight: Styles.globalMargins.xsmall,
    },
    isMobile: {
      flexGrow: 1,
      marginBottom: Styles.globalMargins.small,
      minHeight: 48,
    },
  }),
  inputContainer: {
    backgroundColor: Styles.globalColors.white,
    borderColor: Styles.globalColors.blue,
    borderRadius: 6,
    borderStyle: 'solid',
    borderWidth: 1,
  },
  inputLabel: {
    color: Styles.globalColors.blue,
    paddingBottom: 0,
    paddingLeft: Styles.globalMargins.xsmall,
    paddingRight: Styles.globalMargins.xsmall,
    paddingTop: Styles.globalMargins.tiny,
  },
  outerCard: {
    height: 'auto',
    marginTop: 40,
  },
  outerStyle: {
    backgroundColor: Styles.globalColors.white,
  },
  wrapper: Styles.platformStyles({
    isElectron: {
      width: 400,
    },
    isMobile: {
      width: '100%',
    },
  }),
})

Username.navigationOptions = {
  header: null,
  headerBottomStyle: {height: undefined},
  headerLeft: null, // no back button
}

export default Username
