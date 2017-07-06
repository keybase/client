// @flow
import React, {Component} from 'react'
import {StandardScreen, ChoiceList, Text} from '../../common-adapters'
import {globalMargins} from '../../styles'
import type {Props} from './prove-pgp-choice'

class ProvePgpChoice extends Component<void, Props, void> {
  provePgpChoice() {
    // PGP generation is disabled on native for now.
    return (
      <StandardScreen style={styleContainer} onCancel={this.props.onCancel}>
        <Text style={styleTitle} type="Header">
          Add a PGP key
        </Text>
        <ChoiceList
          options={[
            {
              title: 'Get a new PGP key',
              description: 'Keybase will generate a new PGP key and add it to your profile.',
              icon: 'icon-pgp-key-new-48',
              onClick: () => this.props.onOptionClick('provideInfo'),
            },
            {
              title: 'I have one already',
              description: 'Import an existing PGP key to your Keybase profile.',
              icon: 'icon-pgp-key-import-48',
              onClick: () => this.props.onOptionClick('import'),
            },
          ]}
        />
      </StandardScreen>
    )
  }

  render() {
    return (
      <StandardScreen style={styleContainer} onCancel={this.props.onCancel}>
        <Text style={styleTitle} type="Header">
          Add a PGP key
        </Text>
        <Text type="Body">For now, please use our desktop app to create PGP keys.</Text>
      </StandardScreen>
    )
  }
}

const styleContainer = {
  justifyContent: 'flex-start',
}

const styleTitle = {
  marginBottom: globalMargins.xlarge,
  textAlign: 'center',
}

export default ProvePgpChoice
