// @flow
import Container from '../../forms/container'
import React from 'react'
import {Text, Button, Input, Icon} from '../../../common-adapters'
import {globalMargins} from '../../../styles'

import type {Props} from '.'

const SetPublicName = ({
  onBack,
  onSubmit,
  onChange,
  deviceNameError,
  deviceName,
  waiting,
  submitEnabled = true,
}: Props) => {
  return (
    <Container style={stylesContainer} onBack={onBack}>
      <Text type="Header" style={stylesHeader}>Set a public name for this device:</Text>
      <Icon type="icon-computer-64" style={stylesIcon} />
      <Input
        autoFocus={true}
        errorText={deviceNameError}
        style={stylesInput}
        hintText="Device name"
        onEnterKeyDown={() => onSubmit()}
        onChangeText={text => onChange(text)}
        value={deviceName}
      />
      <Button
        type="Primary"
        style={stylesButton}
        disabled={!submitEnabled}
        waiting={waiting}
        label="Continue"
        onClick={() => onSubmit()}
      />
    </Container>
  )
}

const stylesContainer = {
  alignItems: 'center',
}
const stylesInput = {
  marginTop: globalMargins.small,
  width: 450,
}
const stylesIcon = {
  marginTop: globalMargins.xlarge,
}
const stylesButton = {
  alignSelf: 'center',
  marginTop: globalMargins.large,
}
const stylesHeader = {
  marginTop: globalMargins.xlarge,
}

export default SetPublicName
