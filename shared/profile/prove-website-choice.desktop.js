// @flow
import React, {Component} from 'react'
import {ChoiceScreen} from '../common-adapters'
import type {Props} from './prove-website-choice'

class ProveWebsiteChoice extends Component<void, Props, void> {
  render () {
    return (
      <ChoiceScreen
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
        onCancel={this.props.onCancel}
        title='Prove your website in two ways:'
      />
    )
  }
}

export default ProveWebsiteChoice
