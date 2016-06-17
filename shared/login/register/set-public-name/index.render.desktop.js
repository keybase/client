// @flow
import React from 'react'
import {Text, Button, Input, Icon} from '../../../common-adapters'
import Container from '../../forms/container'
import type {Props} from './index.render'

const SetPublicName = ({onBack, onSubmit, onChange, deviceNameError, deviceName, waiting, submitEnabled = true}: Props) => (
  <Container style={stylesContainer} onBack={onBack}>
    <Text type='Header' style={stylesHeader}>Set a public name for this device:</Text>
    <Icon type='computer-color-m' style={stylesIcon} />
    <Input
      autoFocus
      errorText={deviceNameError}
      style={stylesInput}
      floatingLabelText='Device name'
      onEnterKeyDown={() => onSubmit()}
      onChange={event => onChange(event.target.value)}
      value={deviceName} />
    <Button
      type='Primary'
      style={stylesButton}
      disabled={!submitEnabled}
      waiting={waiting}
      label='Continue'
      onClick={() => onSubmit()} />
  </Container>
)

const stylesContainer = {
  alignItems: 'center',
}
const stylesInput = {
  marginTop: 15,
  width: 450,
}
const stylesIcon = {
  marginTop: 60,
}
const stylesButton = {
  alignSelf: 'flex-end',
  marginTop: 40,
}
const stylesHeader = {
  marginTop: 35,
}

export default SetPublicName
