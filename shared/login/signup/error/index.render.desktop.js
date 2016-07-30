// @flow
import Container from '../../forms/container'
import React, {Component} from 'react'
import type {Props} from './index.render'
import {Text, Button} from '../../../common-adapters'
import {globalStyles} from '../../../styles/style-guide'

class Render extends Component<void, Props, void> {
  render () {
    return (
      <Container onBack={this.props.restartSignup} style={container}>
        <Text type='Header' style={topMargin}>Ah Shoot! Something went wrong, wanna try again?</Text>
        <Text type='Error' style={topMargin}>{this.props.errorText.stringValue()}</Text>
        <Button style={topMargin} type='Secondary' label='Try Again' onClick={() => this.props.restartSignup()} />
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
