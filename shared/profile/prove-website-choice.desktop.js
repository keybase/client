// @flow
import React, {Component} from 'react'
import {StandardScreen, ChoiceList, Text, Button} from '../common-adapters'
import {globalMargins} from '../styles'

import type {Props} from './prove-website-choice'

class ProveWebsiteChoice extends Component<void, Props, void> {
  render() {
    return (
      <StandardScreen onClose={this.props.onCancel} style={{maxWidth: 512}}>
        <Text style={styleTitle} type="Header">Prove your website in two ways:</Text>
        <ChoiceList
          options={[
            {
              title: 'Host a TXT file',
              description: 'Host a text file on your site, such as yoursite.com/keybase.txt.',
              icon: 'icon-file-txt-48',
              onClick: () => this.props.onOptionClick('file'),
            },
            {
              title: 'Set a DNS',
              description: 'Place a Keybase proof in your DNS records.',
              icon: 'icon-dns-48',
              onClick: () => this.props.onOptionClick('dns'),
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

export default ProveWebsiteChoice
