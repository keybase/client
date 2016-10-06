// @flow
import Container from '../../forms/container'
import React, {Component} from 'react'
import type {Props} from './index.render'
import {Box, Button, Icon, Input, Text} from '../../../common-adapters'
import {globalMargins, globalStyles} from '../../../styles'

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
            multiline={true}
            rows={3}
            autoCorrect={true}
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
  marginTop: globalMargins.medium,
  marginBottom: globalMargins.medium,
}

const stylesInput = {
  alignSelf: 'stretch',
  height: 64,
  marginBottom: globalMargins.large,
}

const stylesIcon = {
  marginTop: globalMargins.small,
}

const stylesHeader = {
  marginTop: globalMargins.small,
}

export default PaperKeyRender
