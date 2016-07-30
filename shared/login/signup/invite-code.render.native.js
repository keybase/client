// @flow
import Container from '../forms/container'
import React, {Component} from 'react'
import type {Props} from './invite-code.render'
import {Text, Input, Button, Icon, Box} from '../../common-adapters'
import {globalStyles} from '../../styles/style-guide'

class Render extends Component {
  props: Props;

  state: {
    inviteCode: ?string
  };

  constructor (props: Props) {
    super(props)
    this.state = {
      inviteCode: this.props.inviteCode || '',
    }
  }

  render () {
    const submitInviteCode = () => {
      this.props.onInviteCodeSubmit(this.state.inviteCode)
    }

    return (
      <Container onBack={this.props.onBack} style={styles.container}>
        <Text style={styles.header} type='Header'>Type in your invite code:</Text>
        <Icon style={styles.icon} type='icon-invite-code-48' />
        <Input autoFocus={true} style={styles.input} hintText='goddess brown result reject' value={this.state.inviteCode} errorText={this.props.inviteCodeErrorText} onEnterKeyDown={submitInviteCode} onChangeText={inviteCode => this.setState({inviteCode})} />
        <Button style={styles.button} waiting={this.props.waiting} type='Primary' label='Continue' onClick={submitInviteCode} disabled={!this.state.inviteCode} />
        <Text style={styles.text} type='BodySmall'>Not invited?</Text>
        <Text type='BodySmallSecondaryLink' onClick={this.props.onRequestInvite}>Request an invite</Text>
        <Box style={{flex: 1}} />
      </Container>
    )
  }
}

const styles = {
  button: {
    marginTop: 35,
    alignSelf: 'stretch',
  },
  container: {
    ...globalStyles.flexBoxColumn,
    alignItems: 'center',
  },
  header: {
    marginTop: 74,
  },
  icon: {
    marginTop: 22,
  },
  input: {
    alignSelf: 'stretch',
    marginTop: 0,
  },
  text: {
    marginTop: 32,
  },
}

export default Render
