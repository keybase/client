// TODO remove Container
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import Container from '../../login/forms/container'
import * as Constants from '../../constants/provision'
import {maxUsernameLength} from '../../constants/signup'

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
}

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

type State = {
  username: string
}

class Username extends React.Component<Props, State> {
  state = {username: this.props.initialUsername}

  _submit = () => {
    this.props.onSubmit(this.state.username)
  }

  render() {
    let errorTextComponent
    if (this.props.submittedUsername === this.state.username && !!this.props.inlineError) {
      errorTextComponent = (
        <InlineError
          error={this.props.inlineError}
          onGoToSignup={this.props.inlineSignUpLink ? this.props.onGoToSignup : null}
        />
      )
    }

    return (
      <Container style={styles.container} outerStyle={styles.outerStyle} onBack={() => this.props.onBack()}>
        <Kb.UserCard style={styles.card} outerStyle={styles.outerCard}>
          <Kb.Input
            autoFocus={true}
            style={styles.input}
            hintText="Username"
            maxLength={maxUsernameLength}
            errorText={this.props.submittedUsername === this.state.username ? this.props.error : ''}
            errorTextComponent={errorTextComponent}
            onEnterKeyDown={this._submit}
            onChangeText={text => this.setState({username: text})}
            value={this.state.username}
          />
          <Kb.WaitingButton
            label="Continue"
            fullWidth={true}
            style={styles.button}
            onClick={this._submit}
            disabled={!this.state.username}
            waitingKey={Constants.waitingKey}
          />
          <Kb.Text
            style={styles.forgotUsername}
            type="BodySmallSecondaryLink"
            onClick={this.props.onForgotUsername}
          >
            Forgot your username?
          </Kb.Text>
        </Kb.UserCard>
      </Container>
    )
  }
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
  },
  container: Styles.platformStyles({
    common: {
      flex: 1,
    },
    isElectron: {
      alignItems: 'center',
      justifyContent: 'center',
    },
  }),
  error: {paddingTop: Styles.globalMargins.tiny, textAlign: 'center'},
  errorLink: {
    color: Styles.globalColors.redDark,
    textDecorationLine: 'underline',
  },
  forgotUsername: {
    alignSelf: 'center',
    paddingTop: Styles.globalMargins.small,
  },
  input: Styles.platformStyles({
    isMobile: {
      flexGrow: 1,
      marginBottom: Styles.globalMargins.small,
    },
  }),
  outerCard: {
    marginTop: 40,
  },
  outerStyle: {
    backgroundColor: Styles.globalColors.white,
  },
})

export default Username
