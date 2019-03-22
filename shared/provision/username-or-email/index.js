// @flow
// TODO remove Container
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import Container from '../../login/forms/container'
import * as Constants from '../../constants/provision'

type Props = {|
  inlineError: ?number,
  error: string,
  onBack: () => void,
  onForgotUsername: () => void,
  onGoToSignup: () => void,
  onSubmit: (username: string) => void,
  submittedUsername: string,
|}

const InlineError = (props: {|onGoToSignup: () => void, error: number|}) => {
  let msg = 'This username is not valid.'
  if (Constants.errorNotFound(props.error)) {
    msg = "This username doesn't exist."
  }
  return (
    <Kb.Box2 direction="vertical" centerChildren={true}>
      <Kb.Text type="BodySmallError" style={styles.error}>
        {msg}
      </Kb.Text>
      {Constants.errorNotFound(props.error) && (
        <Kb.Text onClick={props.onGoToSignup} style={styles.errorLink} type="BodySmallPrimaryLink">
          Sign up for a new account?
        </Kb.Text>
      )}
    </Kb.Box2>
  )
}

class Username extends React.Component<Props, State> {
  state = {username: ''}

  render() {
    let errorTextComponent
    if (this.props.submittedUsername === this.state.username && !!this.props.inlineError) {
      // If it's a "bad username" error, show "go to signup" link, otherwise
      // show just the error.
      errorTextComponent = (
        <InlineError error={this.props.inlineError} onGoToSignup={this.props.onGoToSignup} />
      )
    }

    return (
      <Container style={styles.container} outerStyle={styles.outerStyle} onBack={() => this.props.onBack()}>
        <Kb.UserCard style={styles.card} outerStyle={styles.outerCard}>
          <Kb.Input
            autoFocus={true}
            style={styles.input}
            hintText="Username"
            errorText={this.props.submittedUsername === this.state.username ? this.props.error : ''}
            errorTextComponent={errorTextComponent}
            onEnterKeyDown={() => this.props.onSubmit(this.state.username)}
            onChangeText={text => this.setState({username: text})}
            value={this.state.username}
          />
          <Kb.WaitingButton
            label="Continue"
            type="Primary"
            fullWidth={true}
            style={styles.button}
            onClick={() => this.props.onSubmit(this.state.username)}
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
    color: Styles.globalColors.red,
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
