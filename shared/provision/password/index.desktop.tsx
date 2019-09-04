// TODO remove Container
import Container from '../../login/forms/container'
import * as React from 'react'
import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'
import {Props} from '.'

class Password extends React.Component<Props> {
  render() {
    return (
      <Container
        style={styles.container}
        outerStyle={{backgroundColor: Styles.globalColors.white}}
        onBack={() => this.props.onBack()}
      >
        <Kb.UserCard style={styles.card} username={this.props.username}>
          <Kb.Text type="HeaderBig" style={{color: Styles.globalColors.orange}}>
            {this.props.username}
          </Kb.Text>
          <Kb.Input
            autoFocus={true}
            style={styles.input}
            type="password"
            hintText="Password"
            onEnterKeyDown={() => this.props.onSubmit()}
            onChangeText={text => this.props.onChange(text)}
            value={this.props.password}
            errorText={this.props.error}
          />
          <Kb.Button
            waiting={this.props.waitingForResponse}
            label="Continue"
            onClick={() => this.props.onSubmit()}
            disabled={!(this.props.password && this.props.password.length)}
          />
          <Kb.Text style={styles.forgot} type="BodySmallSecondaryLink" onClick={this.props.onForgotPassword}>
            Forgot password?
          </Kb.Text>
        </Kb.UserCard>
      </Container>
    )
  }
}

const styles = Styles.styleSheetCreate(() => ({
  card: {
    alignSelf: 'stretch',
  },
  container: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    marginTop: 40,
  },
  forgot: {
    marginTop: 20,
  },
  input: {
    marginBottom: 48,
    marginTop: 40,
  },
}))

export default Password
