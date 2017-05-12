// @flow
import React, {Component} from 'react'
import type {Props} from './index.render'
import Container from '../../forms/container'
import {Text, Button, Box} from '../../../common-adapters'
import {globalStyles} from '../../../styles'

class ErrorRender extends Component<void, Props, void> {
  render() {
    return (
      <Container onBack={this.props.restartSignup} style={stylesContainer}>
        <Text
          type="Header"
          style={{marginLeft: 10, marginRight: 10, textAlign: 'center'}}
        >
          Ah Shoot! Something went wrong, wanna try again?
        </Text>
        <Text type="BodyError" style={{marginTop: 20, marginBottom: 20}}>
          {this.props.errorText.stringValue()}
        </Text>
        <Button
          type="Secondary"
          label="Try Again"
          onClick={() => this.props.restartSignup()}
        />
        <Box style={{flex: 1}} />
      </Container>
    )
  }
}

const stylesContainer = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
}

export default ErrorRender
