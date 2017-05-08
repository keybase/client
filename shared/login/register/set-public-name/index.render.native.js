// @flow
import Container from '../../forms/container'
import React from 'react'
import type {Props} from './index.render'
import {Box, Button, Icon, Input, Text} from '../../../common-adapters'
import {globalMargins, globalStyles} from '../../../styles'

const SetPublicName = ({onBack, onSubmit, onChange, deviceNameError, deviceName, waiting, submitEnabled}: Props) => {
  submitEnabled = submitEnabled == null ? true : submitEnabled
  return (
    <Container
      style={stylesContainer}
      onBack={onBack}>
      <Text type='Header' style={stylesHeader}>Set a public name for this device:</Text>
      <Icon type='icon-phone-32' style={stylesIcon} />
      <Input
        autoFocus={true}
        style={stylesInput}
        errorText={deviceNameError}
        floatingHintTextOverride='Device name'
        hintText='Device name'
        onEnterKeyDown={() => onSubmit()}
        onChangeText={deviceName => onChange(deviceName)}
        value={deviceName} />
      <Button
        style={stylesButton}
        type='Primary'
        fullWidth={true}
        enabled={deviceName}
        disabled={!submitEnabled}
        waiting={waiting}
        label='Continue'
        onClick={() => onSubmit()} />
    </Container>
  )
}

const stylesContainer = {
  alignItems: 'center',
  justifyContent: 'center',
  marginLeft: globalMargins.small,
  marginRight: globalMargins.small,
}

const stylesHeader = {
  marginTop: globalMargins.tiny,
}

const stylesButton = {
  marginTop: 20,
  marginBottom: 20,
}

const stylesInput = {
  marginTop: globalMargins.tiny,
  marginBottom: globalMargins.tiny,
  alignSelf: 'stretch',
}

const stylesIcon = {
  marginTop: globalMargins.tiny,
  marginBottom: globalMargins.tiny,
}

export default SetPublicName
