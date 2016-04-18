// @flow
import React from 'react'
import {Text, Button, Input, Icon} from '../../../common-adapters'
import Container from '../../forms/container'
import type {Props} from './index.render'

const SetPublicName = ({onBack, onSubmit, onChange, deviceNameError, deviceName, waiting}: Props) => (
  <Container
    style={stylesContainer}
    onBack={onBack}>
    <Text type='Header' style={stylesHeader}>Set a public name for this device:</Text>
    <Icon type='phone-color-m' style={stylesIcon}/>
    <Input
      autoFocus
      style={stylesInput}
      floatingLabelText='Device name'
      hintText='Device name'
      onEnterKeyDown={() => onSubmit()}
      onChangeText={deviceName => onChange(deviceName)}
      value={deviceName}/>
    <Button
      style={stylesButton}
      type='Primary'
      fullWidth
      enabled={deviceName}
      waiting={waiting}
      label='Continue'
      onClick={() => onSubmit()}/>
  </Container>
)

const stylesContainer = {
  flex: 1,
  alignItems: 'center'
}
const stylesButton = {
  flex: 1,
  marginTop: 40,
  marginBottom: 40
}
const stylesInput = {
  marginTop: 30,
  marginBottom: 30
}
const stylesIcon = {
  marginTop: 40,
  marginBottom: 40
}
const stylesHeader = {
  marginTop: 45
}

export default SetPublicName
