import * as React from 'react'
import ChoiceList from './choice-list'
import {action, storiesOf} from '../stories/storybook'

const load = () => {
  storiesOf('Common', module).add('Choice list', () => (
    <ChoiceList
      options={[
        {
          description: 'Host a text file on your site, such as yoursite.com/keybase.txt.',
          icon: 'icon-file-txt-48',
          onClick: () => action('first'),
          title: 'Host a TXT file',
        },
        {
          description: 'Place a Keybase proof in your DNS records.',
          icon: 'icon-dns-48',
          onClick: () => action('second'),
          title: 'Set a DNS',
        },
      ]}
    />
  ))
}

export default load
