// TODO remove Container
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import Container from '../../login/forms/container'
import * as Constants from '../../constants/provision'

type Props = {
  forgotUsernameResult: string
  onBack: () => void
  onSubmit: (email: string) => void
}

type State = {
  email: string
}

class ForgotUsername extends React.Component<Props, State> {
  state = {email: ''}

  render() {
    return (
      <Container style={styles.container} outerStyle={styles.outerStyle} onBack={() => this.props.onBack()}>
        <Kb.UserCard style={styles.card} outerStyle={styles.outerCard}>
          <Kb.Input
            autoFocus={true}
            style={styles.input}
            hintText="Email"
            errorText={this.props.forgotUsernameResult !== 'success' ? this.props.forgotUsernameResult : ''}
            onEnterKeyDown={() => this.props.onSubmit(this.state.email)}
            onChangeText={email => this.setState({email})}
            value={this.state.email}
          />
          <Kb.WaitingButton
            label={
              this.props.forgotUsernameResult === 'success'
                ? 'Username reminder emailed!'
                : 'Email a username reminder'
            }
            fullWidth={true}
            style={styles.button}
            onClick={() => this.props.onSubmit(this.state.email)}
            disabled={!this.state.email || this.props.forgotUsernameResult === 'success'}
            waitingKey={Constants.forgotUsernameWaitingKey}
          />
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

export default ForgotUsername
