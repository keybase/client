// @flow
import React, {Component} from 'react'
import {Text} from '../../../common-adapters'
import Container from '../../forms/container.desktop'
import Row, {RowCSS} from './row'
import type {Props} from './index.render'

class Render extends Component<void, Props, void> {
  render () {
    return (
      <Container
        style={styles.container}
        onBack={() => this.props.onBack()}>
        <RowCSS />
        <Text type='Header' style={styles.header}>Let's sign your installation of keybase with GPG</Text>
        <Text type='Body' style={styles.subHeader}>Allow Keybase to run PGP commands?</Text>
        <Row
          onClick={() => this.props.onSubmit(true)}
          icon='GPG-export'
          title='Export your secret key from GPG'>
          <p>
            <Text type='BodySmall'>This copies your PGP pair into Keybase's local encrypted keyring. Later, you can </Text>
            <Text type='Terminal' inline>keybase pgp sign</Text>
            <Text type='BodySmall'> and </Text>
            <Text type='Terminal' inline>keybase pgp decrypt</Text>
            <Text type='BodySmall'> messages and files.</Text>
          </p>
        </Row>
        <Row
          onClick={() => this.props.onSubmit(false)}
          icon='terminal'
          title='One-time shell to GPG'>
          <p>
            <Text type='BodySmall'>Keybase can ask GPG to sign this install. You won't be able to use </Text>
            <Text type='Terminal' inline>keybase pgp</Text>
            <Text type='BodySmall'> commands on this computer.</Text>
          </p>
        </Row>
      </Container>
    )
  }
}

const styles = {
  container: {
    flex: 1,
    alignItems: 'center',
  },
  header: {
    marginTop: 36,
  },
  subHeader: {
    marginBottom: 30,
  },
}

export default Render
