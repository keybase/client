// @flow
// TODO remove Container
import Container from '../../login/forms/container'
import * as Constants from '../../constants/provision'
import * as React from 'react'
import {WaitingButton, Icon, Input, Text} from '../../common-adapters'
import {globalMargins} from '../../styles'

import type {Props} from '.'

const SetPublicName = ({onBack, onSubmit, onChange, error, deviceName}: Props) => {
  return (
    <Container style={stylesContainer} onBack={onBack}>
      <Text type="Header" style={{textAlign: 'center'}}>
        Set a public name for this device:
      </Text>
      <Icon type="icon-phone-32" style={stylesIcon} />
      <Input
        autoFocus={true}
        style={stylesInput}
        errorText={error}
        floatingHintTextOverride="Device name"
        hintText="Device name"
        onEnterKeyDown={onSubmit}
        onChangeText={onChange}
        value={deviceName}
      />
      <WaitingButton
        style={stylesButton}
        type="Primary"
        fullWidth={true}
        enabled={deviceName}
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
  justifyContent: 'center',
  marginLeft: globalMargins.small,
  marginRight: globalMargins.small,
}

const stylesButton = {
  marginTop: globalMargins.tiny,
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
