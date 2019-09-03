// TODO remove Container
import Container from '../../login/forms/container'
import * as React from 'react'
import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'
import {Props} from '.'

class Password extends React.Component<Props> {
  render() {
    const {showTyping, toggleShowTyping} = this.props

    return (
      <Container
        style={styles.container}
        outerStyle={{backgroundColor: Styles.globalColors.white, padding: 0}}
        onBack={this.props.onBack}
      >
        <Kb.UserCard style={styles.card} username={this.props.username}>
          <Kb.Text center={true} type="Header" style={{color: Styles.globalColors.orange}}>
            {this.props.username}
          </Kb.Text>
          <Kb.FormWithCheckbox
            inputProps={{
              autoFocus: true,
              errorText: this.props.error,
              hintText: 'Password',
              onChangeText: t => this.props.onChange(t),
              onEnterKeyDown: this.props.onSubmit,
              type: showTyping ? 'passwordVisible' : 'password',
              uncontrolled: true,
              value: this.props.password,
            }}
            checkboxesProps={[{checked: !!showTyping, label: 'Show typing', onCheck: toggleShowTyping}]}
          />

          <Kb.Button
            fullWidth={true}
            waiting={this.props.waitingForResponse}
            label="Continue"
            onClick={this.props.onSubmit}
            disabled={!(this.props.password && this.props.password.length)}
          />
          <Kb.Text
            center={true}
            style={styles.forgot}
            type="BodySmallSecondaryLink"
            onClick={this.props.onForgotPassword}
          >
            Forgot password?
          </Kb.Text>
        </Kb.UserCard>
      </Container>
    )
  }
}

const styles = Styles.styleSheetCreate(() => ({
  container: {
    flex: 1,
  },
  forgot: {
    flex: 1,
    marginTop: Styles.globalMargins.medium,
  },
  card: {
    alignItems: 'stretch',
  },
}))

export default Password
