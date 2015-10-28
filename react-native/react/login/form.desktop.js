'use strict'
/* @flow */

import React, { Component } from 'react'
import BaseComponent from '../base-component'
import Switch from '../common-adapters/switch'
import { submitUserPass } from '../actions/login'
import { TextField, RaisedButton, CircularProgress } from 'material-ui'

export default class LoginForm extends BaseComponent {
  constructor (props) {
    super(props)

    this.state = {
      username: props.username || '',
      passphrase: props.passphrase || '',
      storeSecret: props.storeSecret || true
    }
  }

  submit () {
    this.props.onSubmit(this.state.username, this.state.passphrase, this.state.storeSecret)
  }

  render () {
    const activity = this.props.waitingForServer
      ? <CircularProgress mode="indeterminate" />
      : null

    const button = this.props.waitingForServer
      ? <RaisedButton label='Login' disabled={true} />
    : <RaisedButton onClick={() => this.submit()} label='Login' />

    return (
      <div>
        <TextField
          ref='username'
          onChange={e => this.setState({username: e.target.value})}
          placeholder='Username'
          hintText='Username'
          floatingLabelText='Username'
          value={this.state.username} />

        <TextField
          ref='passphrase'
          onChange={e => this.setState({passphrase: e.target.value})}
          placeholder='Passphrase'
          hintText='Passphrase'
          floatingLabelText='Passphrase'
          type='password'
          value={this.state.passphrase} />

        <Switch
          label='Remember me'
          onCheck={(e, checked) => {}}
          value={this.state.storeSecret} />

        {this.props.loginError}
        <br />
        {button}
        <br />
        {activity}
      </div>
    )
  }

  static parseRoute (store) {
    // TODO(mm): maybe we can just pass the state here instead of the store.
    const {username, passphrase, storeSecret, waitingForServer} = store.getState().login
    const componentAtTop = {
      title: 'Login',
      component: LoginForm,
      leftButtonTitle: 'Cancel',
      mapStateToProps: state => state.login,
      props: {
        onSubmit: (username, passphrase, storeSecret) => store.dispatch(submitUserPass(username, passphrase, storeSecret)),
        username,
        passphrase,
        storeSecret,
        waitingForServer
      }
    }

    return {
      componentAtTop,
      parseNextRoute: null // terminal node, so no next route
    }
  }
}

LoginForm.propTypes = {
  username: React.PropTypes.string,
  passphrase: React.PropTypes.string,
  storeSecret: React.PropTypes.bool,
  loginError: React.PropTypes.string,
  onSubmit: React.PropTypes.func,
  waitingForServer: React.PropTypes.bool
}
