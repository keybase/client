// @flow
import React, {Component} from 'react'
import {StandardScreen, Icon, Text} from '../../common-adapters'
import {globalMargins} from '../../styles'
import type {Props} from './prove-pgp-import'

class ProvePgpImport extends Component<void, Props, void> {
  render() {
    return (
      <StandardScreen onClose={this.props.onCancel} style={styleContainer}>
        <Icon style={styleHeaderIcon} type="icon-pgp-key-import-48" />
        <Text style={styleBody} type="Body">
          Importing a PGP key is not supported on our mobile app. To continue, download the Keybase desktop app and follow the instructions there.
        </Text>
      </StandardScreen>
    )
  }
}

const styleContainer = {
  justifyContent: 'flex-start',
}

const styleHeaderIcon = {
  alignSelf: 'center',
  marginTop: globalMargins.large,
}

const styleBody = {
  textAlign: 'center',
  margin: globalMargins.medium,
  marginTop: globalMargins.large,
}

export default ProvePgpImport
