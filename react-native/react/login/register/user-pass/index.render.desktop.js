import React, {Component, StyleSheet} from '../../../base-react'
import {TextField, RaisedButton} from 'material-ui'

export default class UserPassRender extends Component {
  render () {
    return (
      <div style={styles.container}>
        <h1>{this.props.title}</h1>
        <h2>{this.props.subTitle}</h2>

        <TextField
          hintText='Keybase Username'
          floatingLabelText='Username'
          onEnterKeyDown={event => this.refs['passphrase'].focus()}
          ref='username'
          onChange={event => this.props.onChangeUsername(event.target.value)}
          value={this.props.username}
        />
        <TextField
          hintText='Keybase Passphrase'
          floatingLabelText='Password'
          type='password'
          ref='passphrase'
          onEnterKeyDown={() => this.props.onSubmit() }
          onChange={event => this.props.onChangePassphrase(event.target.value)}
          value={this.props.passphrase}
        />

        {this.props.error && (
          <p>{this.props.error.toString()}</p>
        )}

        <RaisedButton
          style={{alignSelf: 'flex-end', marginTop: 20}}
          label='Submit'
          primary
          onClick={() => this.props.onSubmit()}
          disabled={!this.props.buttonEnabled}
        />
      </div>
    )
  }
}

UserPassRender.propTypes = {
  username: React.PropTypes.string,
  passphrase: React.PropTypes.string,
  onChangeUsername: React.PropTypes.func.isRequired,
  onChangePassphrase: React.PropTypes.func.isRequired,
  error: React.PropTypes.object,
  onSubmit: React.PropTypes.func.isRequired,
  title: React.PropTypes.string,
  subTitle: React.PropTypes.string,
  buttonEnabled: React.PropTypes.bool.isRequired
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    justifyContent: 'flex-start',
    paddingTop: 100,
    padding: 20
  }
})
