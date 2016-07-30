// @flow
import Container from '../../forms/container'
import React, {Component} from 'react'
import type {Props} from './index.render'
import {Box, Button, Icon, Input, Text} from '../../../common-adapters'
import {globalStyles} from '../../../styles/style-guide'

class PaperKeyRender extends Component<void, Props, void> {
  render () {
    return (
      <Box style={stylesBox}>
        <Container
          style={stylesContainer}
          onBack={this.props.onBack}>
          <Text type='Header' style={stylesHeader}>Type in your paper key:</Text>
          <Icon type='icon-paper-key-48' style={stylesIcon} />
          <Input
            autoFocus={true}
            style={stylesInput}
            floatingLabelText='Paper key'
            hintText='opp blezzard tofi pando'
            errorText={this.props.error}
            onEnterKeyDown={() => this.props.onSubmit()}
            onChangeText={paperKey => this.props.onChangePaperKey(paperKey)}
            type='passwordVisible'
            value={this.props.paperKey ? this.props.paperKey : null} />
          <Button
            style={stylesButton}
            type='Primary'
            fullWidth={true}
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
