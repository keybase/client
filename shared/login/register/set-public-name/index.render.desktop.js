// @flow
import Container from '../../forms/container'
import React from 'react'
import type {Props} from './index.render'
import {Text, Button, Input, Icon} from '../../../common-adapters'

const SetPublicName = ({onBack, onSubmit, onChange, deviceNameError, deviceName, waiting, submitEnabled = true}: Props) => {
  return (
    <Container style={stylesContainer} onBack={onBack}>
      <Text type='Header' style={stylesHeader}>Set a public name for this device:</Text>
      <Icon type='icon-computer-colors-64' style={stylesIcon} />
      <Input
        autoFocus={true}
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
}

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
