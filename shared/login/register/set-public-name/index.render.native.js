// @flow
import React from 'react'
import {Box, Button, Icon, Input, Text} from '../../../common-adapters'
import Container from '../../forms/container'
import type {Props} from './index.render'
import {globalStyles} from '../../../styles/style-guide'

const SetPublicName = ({onBack, onSubmit, onChange, deviceNameError, deviceName, waiting, submitEnabled = true}: Props) => (
  <Box style={stylesBox}>
    <Container
      style={stylesContainer}
      onBack={onBack}>
      <Text type='Header' style={stylesHeader}>Set a public name for this device:</Text>
      <Icon type='phone-color-m' style={stylesIcon} />
      <Input
        autoFocus
        style={stylesInput}
        floatingLabelText='Device name'
        hintText='Device name'
        onEnterKeyDown={() => onSubmit()}
        onChangeText={deviceName => onChange(deviceName)}
        value={deviceName} />
      <Button
        style={stylesButton}
        type='Primary'
        fullWidth
        enabled={deviceName}
        disabled={!submitEnabled}
        waiting={waiting}
        label='Continue'
        onClick={() => onSubmit()} />
    </Container>
  </Box>
)

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
}

const stylesIcon = {
  marginTop: 30,
  marginBottom: 30,
}

const stylesHeader = {
  marginTop: 45,
}

export default SetPublicName
