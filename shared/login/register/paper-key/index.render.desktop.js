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
        multiLine={true}
        style={styles.input}
        errorText={error}
        hintText='opp blezzard tofi pando agg whi pany yaga jocket daubt bruwnstane hubit yas'
        onEnterKeyDown={() => onSubmit()}
        onChange={event => onChangePaperKey(event.target.value)}
        value={paperKey}
      />
      <Button
        label='Continue'
        type='Primary'
        style={{alignSelf: 'flex-end'}}
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
    marginBottom: 65,
  },
  input: {
    alignSelf: 'stretch',
    marginBottom: 55,
  },
}

export default Render
