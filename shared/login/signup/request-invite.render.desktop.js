/* @flow */
/* eslint-disable react/prop-types */

import React, {Component} from 'react'
import {globalStyles} from '../../styles/style-guide'
import {Text, Icon, Input, Button} from '../../common-adapters'
import Container from '../forms/container'

import type {Props} from './request-invite.render'

export default class Render extends Component {
  props: Props;

  render () {
    return (
      <Container onBack={this.props.onBack} style={styles.container}>
        <Text style={styles.header} type='Header'>Request an invite code</Text>
        <Icon style={styles.icon} type='invite-code-m' />
        <Input
          style={styles.input}
          floatingLabelText='Your email address'
          value={this.props.email}
          errorText={this.props.emailErrorText}
          onChangeText={email => this.props.emailChange(email)}
          autoFocus />
        <Input
          style={styles.input}
          floatingLabelText='Your name'
          value={this.props.name}
          errorText={this.props.nameErrorText}
          onChangeText={name => this.props.nameChange(name)} />
        <Button
          style={styles.button}
          waiting={this.props.waiting}
          type='Primary'
          label='Request'
          onClick={this.props.onSubmit}
          disabled={!this.props.email} />
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
