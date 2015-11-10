'use strict'
/* @flow */

import React, {Component, StyleSheet} from '../../../base-react'
import {TextField, RaisedButton} from 'material-ui'

export default class UserPassRender extends Component {
  constructor (props) {
    super(props)

    this.state = {
      username: props.username || 'test13',
      passphrase: props.passphrase || 'okokokokokok'
    }
  }

  onSubmit () {
    this.props.onSubmit(this.state.username, this.state.passphrase)
  }

  render () {
    return (
      <div style={styles.container}>
        <h1>{this.props.title}</h1>
        <h2>{this.props.subTitle}</h2>

        <TextField
          hintText='Keybase Username'
          floatingLabelText='Username'
          onEnterKeyDown={(event) => this.refs['passphrase'].focus()}
          ref='username'
          onChange={() => this.setState({username: this.refs.username.getValue()})}
          value={this.state.username}
        />
        <TextField
          hintText='Keybase Passphrase'
          floatingLabelText='Password'
          type='password'
          ref='passphrase'
          onEnterKeyDown={() => this.onSubmit() }
          onChange={() => this.setState({passphrase: this.refs.passphrase.getValue()})}
          value={this.state.passphrase}
        />

        {this.props.error && (
          <p>{this.props.error.toString()}</p>
        )}

        <RaisedButton
          style={{alignSelf: 'flex-end', marginTop: 20}}
          label='Submit'
          primary
          onClick={() => this.onSubmit()}
          disabled={!this.props.buttonEnabled(this.state.username, this.state.passphrase)}
        />
      </div>
    )
  }
}

UserPassRender.propTypes = {
  username: React.PropTypes.string,
  passphrase: React.PropTypes.string,
  error: React.PropTypes.object,
  onSubmit: React.PropTypes.func.isRequired,
  title: React.PropTypes.string,
  subTitle: React.PropTypes.string,
  buttonEnabled: React.PropTypes.func.isRequired
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

