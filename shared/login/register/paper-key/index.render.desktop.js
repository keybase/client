// @flow
import Container from '../../forms/container.desktop'
import React from 'react'
import type {Props} from './index.render'
import {Text, Icon, Input, Button} from '../../../common-adapters'

const Render = ({onBack, onSubmit, onChangePaperKey, error, paperKey, waitingForResponse}: Props) => {
  return (
    <Container
      style={styles.container}
      onBack={() => onBack()}>
      <Text type='Header' style={styles.header}>Type in your paper key:</Text>
      <Icon type='icon-paper-key-48' style={styles.icon} />
      <Input
        autoFocus={true}
        multiline={true}
        rowsMax={3}
        style={styles.input}
        errorText={error}
        floatingHintTextOverride='Paper key'
        hintText='opp blezzard tofi pando agg whi pany yaga jocket daubt bruwnstane hubit yas'
        onEnterKeyDown={() => onSubmit()}
        onChangeText={text => onChangePaperKey(text)}
        value={paperKey}
      />
      <Button
        label='Continue'
        type='Primary'
        onClick={() => onSubmit()}
        enabled={paperKey}
        waiting={waitingForResponse}
      />
    </Container>
  )
}

const styles = {
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    marginTop: 46,
  },
  icon: {
    marginTop: 45,
  },
  input: {
    marginBottom: 55,
    height: '4em',
  },
}

export default Render
