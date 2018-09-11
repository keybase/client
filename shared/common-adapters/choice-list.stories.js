// @flow
import * as React from 'react'
import ChoiceList from './choice-list'
import {action, storiesOf} from '../stories/storybook'

const load = () => {
  storiesOf('Common', module).add('Choice list', () => (
    <ChoiceList
      options={[
        {
          title: 'Host a TXT file',
          description: 'Host a text file on your site, such as yoursite.com/keybase.txt.',
          icon: 'icon-file-txt-48',
          onClick: () => action('first'),
        },
        {
          title: 'Set a DNS',
          description: 'Place a Keybase proof in your DNS records.',
          icon: 'icon-dns-48',
          onClick: () => action('second'),
        },
      ]}
    />
  ))
}

export default load
