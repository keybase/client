// @flow
import Container from '../../forms/container.desktop'
import React, {Component} from 'react'
import type {Props} from './index.render'
import {Text, Icon} from '../../../common-adapters'

class Render extends Component<void, Props, void> {
  render () {
    return (
      <Container
        style={styles.container}
        onBack={() => this.props.onBack()}>
        <Icon type='icon-no-gpg' style={styles.icon} />
        <Text type='HeaderError' style={styles.header}>You don't have a GPG pinentry app installed.</Text>
        <p style={styles.paragraph}>
          <Text type='Body' inline={true}>If you want to use GPG to provision this device, you’ll need to use the </Text>
          <Text type='Terminal' inline={true}>keybase</Text>
          <Text type='Body' inline={true}> command line application or choose another way to provision this device.</Text>
        </p>
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
    marginTop: 44,
  },
  icon: {
    fontSize: 30,
    marginTop: 90,
  },
  paragraph: {
    textAlign: 'center',
    marginTop: 5,
    width: 523,
  },
}

export default Render
