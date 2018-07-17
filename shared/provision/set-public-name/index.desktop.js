// @flow
// TODO merge  this and native
// TODO remove Container
import Container from '../../login/forms/container'
import * as Constants from '../../constants/provision'
import * as React from 'react'
import {Text, WaitingButton, Input, Icon} from '../../common-adapters'
import {globalMargins} from '../../styles'

import type {Props} from '.'

const SetPublicName = ({onBack, onSubmit, onChange, deviceNameError, deviceName}: Props) => {
  return (
    <Container style={stylesContainer} onBack={onBack}>
      <Text type="Header" style={stylesHeader}>
        Set a public name for this device:
      </Text>
      <Icon type="icon-computer-64" style={stylesIcon} />
      <Input
        autoFocus={true}
        errorText={deviceNameError}
        style={stylesInput}
        hintText="Device name"
        onEnterKeyDown={onSubmit}
        onChangeText={onChange}
        value={deviceName}
      />
      <WaitingButton
        type="Primary"
        style={stylesButton}
        disabled={!onSubmit}
        label="Continue"
        onClick={onSubmit}
        waitingKey={Constants.waitingKey}
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
