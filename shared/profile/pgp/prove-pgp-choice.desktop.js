// @flow
import React, {Component} from 'react'
import {StandardScreen, ChoiceList, Text, Button} from '../../common-adapters'
import {globalMargins} from '../../styles'
import type {Props} from './prove-pgp-choice'

class ProvePgpChoice extends Component<Props> {
  render() {
    return (
      <StandardScreen onCancel={this.props.onCancel} style={{maxWidth: 512}}>
        <Text style={styleTitle} type="Header">
          Add a PGP key
        </Text>
        <ChoiceList
          options={[
            {
              description: 'Keybase will generate a new PGP key and add it to your profile.',
              icon: 'icon-pgp-key-new-48',
              onClick: () => this.props.onOptionClick('provideInfo'),
              title: 'Get a new PGP key',
            },
            {
              description: 'Import an existing PGP key to your Keybase profile.',
              icon: 'icon-pgp-key-import-48',
              onClick: () => this.props.onOptionClick('import'),
              title: 'I have one already',
            },
          ]}
        />
        <Button
          style={styleCancelButton}
          type="Secondary"
          onClick={() => this.props.onCancel()}
          label={'Cancel'}
        />
      </StandardScreen>
    )
  }
}

const styleTitle = {
  marginBottom: globalMargins.medium,
}

const styleCancelButton = {
  marginTop: globalMargins.medium,
}

export default ProvePgpChoice
