// TODO remove Container
import Container from '../../login/forms/container'
import * as React from 'react'
import Row, {RowCSS} from './row.desktop'
import {Text, Box2} from '../../common-adapters'

import {Props} from '.'

class GPGSign extends React.Component<Props> {
  render() {
    return (
      <Container style={styles.container} onBack={() => this.props.onBack()}>
        <RowCSS />
        {this.props.importError && (
          <Box2 direction="vertical" centerChildren={true}>
            <Text type="Header" style={styles.header}>
              There was an error importing your pgp key:
              {'\n'}
            </Text>
            <Text type="BodySmallError">{this.props.importError}</Text>
            <Text type="Body">You can try asking gpg to sign this install instead.</Text>
          </Box2>
        )}
        <Text type="Header" style={styles.header}>
          Let's sign your installation of keybase with GPG
        </Text>
        <Text type="Body" style={styles.subHeader}>
          Allow Keybase to run PGP commands?
        </Text>
        <Box2 direction="vertical" centerChildren={true} style={{maxWidth: 750}}>
          {!this.props.importError && (
            <Row
              onClick={() => this.props.onSubmit(true)}
              icon="icon-GPG-export"
              title="Export your secret key from GPG"
            >
              <p>
                <Text type="BodySmall">
                  This copies your PGP pair into Keybase's local encrypted keyring. Later, you can{' '}
                </Text>
                <Text type="Terminal">keybase pgp sign</Text>
                <Text type="BodySmall"> and </Text>
                <Text type="Terminal">keybase pgp decrypt</Text>
                <Text type="BodySmall"> messages and files.</Text>
              </p>
            </Row>
          )}
          <Row
            onClick={() => this.props.onSubmit(false)}
            icon="icon-terminal-48"
            title="One-time shell to GPG"
          >
            <p>
              <Text type="BodySmall">
                Keybase can ask GPG to sign this install. You won't be able to use{' '}
              </Text>
              <Text type="Terminal">keybase pgp</Text>
              <Text type="BodySmall"> commands on this computer.</Text>
            </p>
          </Row>
        </Box2>
      </Container>
    )
  }
}

const styles = {
  container: {
    alignItems: 'center',
    flex: 1,
  },
  header: {
    marginTop: 36,
  },
  subHeader: {
    marginBottom: 30,
  },
}

export default GPGSign
