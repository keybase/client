// @flow
import React from 'react'
import {Text, Button, Input, Icon} from '../../../common-adapters'
import Container from '../../forms/container'
import type {Props} from './index.render'

const SetPublicName = ({onBack, onSubmit, onChange, deviceNameError, deviceName, waitingForResponse}: Props) => (
  <Container style={styles.container} onBack={onBack}>
    <Text type='Header' style={styles.header}>Set a public name for this device:</Text>
    <Icon type='computer-color-m' style={styles.icon}/>
    <Input
      autoFocus
      errorText={deviceNameError}
      style={styles.input}
      floatingLabelText='Device name'
      onEnterKeyDown={() => onSubmit()}
      onChange={event => onChange(event.target.value)}
      value={deviceName}/>
    <Button
      type='Primary'
      fullWidth
      style={styles.button}
      waiting={waitingForResponse}
      label='Continue'
      onClick={() => onSubmit()} />
  </Container>
)

const styles = {
  container: {
    alignItems: 'center'
  },
  input: {
    marginTop: 15,
    alignSelf: 'stretch'
  },
  icon: {
    marginTop: 60
  },
  button: {
    alignSelf: 'flex-end',
    marginTop: 40
  },
  header: {
    marginTop: 35
  }
}

export default SetPublicName
