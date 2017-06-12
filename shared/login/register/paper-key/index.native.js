// @flow
import Container from '../../forms/container'
import React, {Component} from 'react'
import {Button, Icon, Input, Text} from '../../../common-adapters'
import {globalMargins} from '../../../styles'

import type {Props} from '.'

class PaperKey extends Component<void, Props, void> {
  render() {
    return (
      <Container style={stylesContainer} onBack={this.props.onBack}>
        <Text type="Header">Type in your paper key:</Text>
        <Icon type="icon-paper-key-48" />
        <Input
          multiline={true}
          rowsMin={3}
          autoFocus={true}
          style={stylesInput}
          floatingHintTextOverride="Paper key"
          hintText="opp blezzard tofi pando"
          errorText={this.props.error}
          onEnterKeyDown={() => this.props.onSubmit()}
          onChangeText={paperKey => this.props.onChangePaperKey(paperKey)}
          type="passwordVisible"
          value={this.props.paperKey ? this.props.paperKey : null}
        />
        <Button
          type="Primary"
          enabled={this.props.paperKey}
          label="Continue"
          waiting={this.props.waitingForResponse}
          onClick={() => this.props.onSubmit()}
        />
      </Container>
    )
  }
}

const stylesContainer = {
  alignItems: 'center',
  paddingLeft: globalMargins.medium,
  paddingRight: globalMargins.medium,
}

const stylesInput = {
  alignSelf: 'stretch',
}

export default PaperKey
