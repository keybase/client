// @flow
import React, {Component} from 'react'
import {StandardScreen, ChoiceList, Text} from '../../common-adapters'
import {globalMargins} from '../../styles'
import type {Props} from '.'

class ProveWebsiteChoice extends Component<Props> {
  render() {
    return (
      <StandardScreen style={styleContainer} onCancel={this.props.onCancel}>
        <Text style={styleTitle} type="Header">
          Prove your website in two ways:
        </Text>
        <ChoiceList
          options={[
            {
              description: 'Host a text file on your site, such as yoursite.com/keybase.txt.',
              icon: 'icon-file-txt-48',
              onClick: () => this.props.onOptionClick('file'),
              title: 'Host a TXT file',
            },
            {
              description: 'Place a Keybase proof in your DNS records.',
              icon: 'icon-dns-48',
              onClick: () => this.props.onOptionClick('dns'),
              title: 'Set a DNS',
            },
          ]}
        />
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

export default ProveWebsiteChoice
