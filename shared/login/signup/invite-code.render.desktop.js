/* @flow */
/* eslint-disable react/prop-types */

import React, {Component} from 'react'
import {globalStyles} from '../../styles/style-guide'
import {Text, Input, Button, Icon} from '../../common-adapters'
import Container from '../forms/container'
import type {Props} from './invite-code.render'

export default class Render extends Component {
  props: Props;

  state: {
    inviteCode: ?string
  };

  constructor (props: Props) {
    super(props)
    this.state = {
      inviteCode: this.props.inviteCode || ''
    }
  }

  render () {
    const submitInviteCode = () => {
      this.props.onInviteCodeSubmit(this.state.inviteCode)
    }

    return (
      <Container onBack={this.props.onBack} style={styles.container}>
        <Text style={styles.header} type='Header'>Type in your invite code:</Text>
        <Icon style={styles.icon} type='invite-code-m'/>
        <Input style={styles.input} hintText='goddess brown result reject' value={this.state.inviteCode} errorText={this.props.inviteCodeErrorText} onEnterKeyDown={submitInviteCode} onChange={event => this.setState({inviteCode: event.target.value})}/>
        <Button style={styles.button} type='Primary' label='Continue' onClick={submitInviteCode} disabled={!this.state.inviteCode}/>
        <Text style={styles.text} type='Body'>Not invited?</Text>
        <Text type='BodyPrimaryLink' onClick={this.props.onRequestInvite}>Request an invite code</Text>
      </Container>
    )
  }
}

const styles = {
  button: {
    marginTop: 10,
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
    marginTop: 75
  },
  input: {
    alignSelf: 'stretch',
    height: 45,
    marginTop: 75
  },
  text: {
    marginTop: 40
  }
}
