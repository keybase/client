/* @flow */
/* eslint-disable react/prop-types */

import React, {Component} from 'react'
import {globalStyles} from '../../styles/style-guide'
import {Text, Icon, Input, Button} from '../../common-adapters'
import Container from '../forms/container'

import type {Props} from './request-invite.render'

export default class Render extends Component {
  props: Props;

  state: {
    email: ?string,
    name: ?string
  };

  constructor (props: Props) {
    super(props)
    this.state = {
      email: this.props.email || '',
      name: this.props.name || '',
    }
  }

  render () {
    const submitRequestInvite = () => {
      this.props.onRequestInvite(this.state.email, this.state.name)
    }

    return (
      <Container onBack={this.props.onBack} style={styles.container}>
        <Text style={styles.header} type='Header'>Request an invite code</Text>
        <Icon style={styles.icon} type='invite-code-m'/>
        <Input
          style={styles.input}
          floatingLabelText='Your email address'
          value={this.state.email || ''}
          errorText={this.props.emailErrorText}
          onChange={event => this.setState({email: event.target.value})}
        />
        <Input
          style={styles.input}
          floatingLabelText='Your name'
          value={this.state.name || ''}
          errorText={this.props.nameErrorText}
          onChange={event => this.setState({name: event.target.value})}
        />
        <Button
          style={styles.button}
          type='Primary'
          label='Request'
          onClick={submitRequestInvite}
          disabled={!this.state.email}
        />
      </Container>
    )
  }
}

const styles = {
  button: {
    marginTop: 50,
    marginBottom: 30,
    marginRight: 0,
    alignSelf: 'flex-end'
  },
  container: {
    ...globalStyles.flexBoxColumn,
    alignItems: 'center'
  },
  continue: {
    justifyContent: 'flex-end'
  },
  header: {
    marginTop: 30
  },
  icon: {
    marginTop: 55
  },
  input: {
    alignSelf: 'stretch',
    height: 45,
    marginTop: 25
  },
  text: {
    marginTop: 40
  }
}
