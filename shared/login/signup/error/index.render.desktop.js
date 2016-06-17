/* @flow */

import React, {Component} from 'react'
import {globalStyles} from '../../../styles/style-guide'
import {Text, Button} from '../../../common-adapters'
import Container from '../../forms/container'

import type {Props} from './index.render'

class Render extends Component<void, Props, void> {
  render () {
    return (
      <Container onBack={this.props.resetSignup} style={container}>
        <Text type='Header' style={topMargin}>Ah Shoot! Something went wrong, wanna try again?</Text>
        <Text type='Error' style={topMargin}>{this.props.errorText.stringValue()}</Text>
        <Button style={topMargin} type='Secondary' label='Try Again' onClick={() => this.props.resetSignup()} />
      </Container>
    )
  }
}

const container = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  flex: 1,
}

const topMargin = {marginTop: 30}

export default Render
