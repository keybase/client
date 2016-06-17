// @flow
import React from 'react'
import {Text, Icon, Input, Button} from '../../../common-adapters'
import Container from '../../forms/container.desktop'
import type {Props} from './index.render'

const Render = ({onBack, onSubmit, onChangePaperKey, paperKey, waitingForResponse}: Props) => {
  return (
    <Container
      style={styles.container}
      onBack={() => onBack()}>
      <Text type='Header' style={styles.header}>Type in your paper key:</Text>
      <Icon type='paper-key-m' style={styles.icon} />
      <Input
        autoFocus
        multiLine
        style={styles.input}
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
