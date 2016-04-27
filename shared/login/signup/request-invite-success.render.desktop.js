/* @flow */

import React, {Component} from 'react'
import {globalStyles} from '../../styles/style-guide'
import {Text, Icon} from '../../common-adapters'
import Container from '../forms/container'

import type {Props} from './request-invite-success.render'

export default class Render extends Component {
  props: Props;

  render () {
    return (
      <Container onBack={this.props.onBack} style={styles.container}>
        <Icon style={styles.icon} type='invite-code-m' />
        <Text style={styles.header} type='Header'>Invite request sent</Text>
        <Text style={styles.body} type='Body'>
          Thanks for requesting an invite to Keybase. When one becomes available,  we will send it to you via email.
        </Text>
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
    marginTop: 80
  },
  header: {
    marginTop: 50,
    marginBottom: 10
  },
  body: {
    paddingLeft: 15,
    paddingRight: 15,
    marginBottom: 35,
    textAlign: 'center'
  }
}
