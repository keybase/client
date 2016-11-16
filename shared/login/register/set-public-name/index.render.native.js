// @flow
import Container from '../../forms/container'
import React from 'react'
import type {Props} from './index.render'
import {Box, Button, Icon, Input, Text} from '../../../common-adapters'
import {globalMargins, globalStyles} from '../../../styles'

const SetPublicName = ({onBack, onSubmit, onChange, deviceNameError, deviceName, waiting, submitEnabled}: Props) => {
  submitEnabled = submitEnabled == null ? true : submitEnabled
  return (
    <Box style={stylesBox}>
      <Container
        style={stylesContainer}
        onBack={onBack}>
        <Text type='Header' style={stylesHeader}>Set a public name for this device:</Text>
        <Icon type='icon-phone-colors-32' style={stylesIcon} />
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
    </Box>
  )
}

const stylesBox = {
  ...globalStyles.flexBoxColumn,
  padding: 10,
}

const stylesContainer = {
  alignItems: 'center',
}

const stylesHeader = {
  marginTop: globalMargins.small,
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
  marginTop: globalMargins.small,
  marginBottom: globalMargins.small,
}

export default SetPublicName
