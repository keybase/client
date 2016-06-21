// @flow
import React from 'react'
import {Text} from '../../../common-adapters'
import Container from '../../forms/container'
import type {Props} from './index.render'

const Render = ({onBack, error}: Props) => (
  <Container
    style={styles.container}
    onBack={onBack}>
    <Text type='Header' style={styles.header}>There was an error provisioning</Text>
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
  return <Text type='Body'>Unknown error: {error.toString()}</Text>
}

export default Render
