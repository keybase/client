/* @flow */

import React, {Component} from 'react'
import {globalStyles} from '../../styles/style-guide'
import {Text, Icon} from '../../common-adapters'
import Container from '../forms/container'

import type {Props} from './request-invite-success.render'

class RequestInviteSuccess extends Component {
  props: Props;

  render () {
    return (
      <Container onBack={this.props.onBack} style={styles.container}>
        <Icon style={styles.icon} type='invite-code-m'/>
        <Text style={styles.header} type='Header'>Invite request sent</Text>
        <Text style={styles.body} type='Body'>Foo.</Text>
      </Container>
    )
  }
}

const styles = {
  container: {
    ...globalStyles.flexBoxColumn,
    alignItems: 'center'
  },
  icon: {
    marginTop: 55
  },
  text: {
    marginTop: 40
  }
}
