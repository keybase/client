// @flow
import React, {Component} from 'react'
import {StandardScreen, Icon, Text} from '../../common-adapters'
import {globalMargins} from '../../styles/style-guide'
import type {Props} from './prove-pgp-import'

class ProvePgpImport extends Component<void, Props, void> {
  render () {
    return (
      <StandardScreen onClose={this.props.onCancel} style={styleContainer}>
        <Icon type='icon-pgp-key-48' />
        <Text type='Body'>Importing a PGP key is not supported on our mobile app. To continue, download the Keybase desktop app and follow the instructions there.</Text>
      </StandardScreen>
    )
  }
}

const styleContainer = {
  maxWidth: 576,
  padding: globalMargins.medium,
  marginLeft: globalMargins.medium,
  marginRight: globalMargins.medium,
}
export default ProvePgpImport
