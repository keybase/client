// @flow
import Container from '../../forms/container'
import React from 'react'
import type {Props} from './index.render'
import {Text} from '../../../common-adapters'

const Render = ({onBack, error}: Props) => (
  <Container style={styles.container} onBack={onBack}>
    <Text type="Header" style={styles.header}>There was an error provisioning</Text>
    {renderError(error)}
  </Container>
)

const styles = {
  container: {},
  header: {
    alignSelf: 'center',
    marginTop: 46,
    marginBottom: 20,
  },
}

const renderError = error => {
  return <Text type="Body" style={{textAlign: 'center'}}>Unknown error: {error.message}</Text>
}

export default Render
