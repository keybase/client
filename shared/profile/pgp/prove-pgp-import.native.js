// @flow
import React, {Component} from 'react'
import {StandardScreen, Icon, Text} from '../../common-adapters'
import {globalMargins} from '../../styles/style-guide'
import type {Props} from './prove-pgp-import'

class ProvePgpImport extends Component<void, Props, void> {
  render () {
    return (
      <StandardScreen onClose={this.props.onCancel} style={styleContainer}>
        <Icon style={styleHeaderIcon} type='icon-pgp-key-48' />
        <Text style={styleBody} type='Body'>Importing a PGP key is not supported on our mobile app. To continue, download the Keybase desktop app and follow the instructions there.</Text>
      </StandardScreen>
    )
  }
}

const styleContainer = {
  justifyContent: 'flex-start',
}

const styleHeaderIcon = {
  marginTop: globalMargins.large,
  alignSelf: 'center',
}

const styleBody = {
  marginTop: globalMargins.large,
  textAlign: 'center',
  margin: globalMargins.medium,
}

export default ProvePgpImport
