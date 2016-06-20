// @flow
import React, {Component} from 'react'
import {Box, Button, Icon, Input, Text} from '../../../common-adapters'
import Container from '../../forms/container'
import type {Props} from './index.render'
import {globalStyles} from '../../../styles/style-guide'

class PaperKeyRender extends Component<void, Props, void> {
  props: Props;

  render () {
    return (
      <Box style={stylesBox}>
        <Container
          style={stylesContainer}
          onBack={this.props.onBack}>
          <Text type='Header' style={stylesHeader}>Type in your paper key:</Text>
          <Icon type='paper-key-m' style={stylesIcon} />
          <Input
            autoFocus
            style={stylesInput}
            floatingLabelText='Paper key'
            hintText='opp blezzard tofi pando'
            onEnterKeyDown={() => this.props.onSubmit()}
            onChangeText={paperKey => this.props.onChangePaperKey(paperKey)}
            type='passwordVisible'
            value={this.props.paperKey ? this.props.paperKey : null} />
          <Button
            style={stylesButton}
            type='Primary'
            fullWidth
            enabled={this.props.paperKey}
            label='Continue'
            waiting={this.props.waitingForResponse}
            onClick={() => this.props.onSubmit()} />
        </Container>
      </Box>
    )
  }
}

const stylesBox = {
  ...globalStyles.flexBoxColumn,
  padding: 10,
}

const stylesContainer = {
  alignItems: 'center',
}

const stylesButton = {
  marginTop: 20,
  marginBottom: 20,
}

const stylesInput = {
  marginTop: 20,
  marginBottom: 20,
  alignSelf: 'stretch',
  height: 80,
}

const stylesIcon = {
  marginTop: 30,
  marginBottom: 30,
}

const stylesHeader = {
  marginTop: 45,
}

export default PaperKeyRender
