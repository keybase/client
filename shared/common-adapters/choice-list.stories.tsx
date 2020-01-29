import * as React from 'react'
import ChoiceList from './choice-list'
import {IconType} from './icon'
import {action, storiesOf} from '../stories/storybook'

const Kb = {IconType}

const load = () => {
  storiesOf('Common', module).add('Choice list', () => (
    <ChoiceList
      options={[
        {
          description: 'Host a text file on your site, such as yoursite.com/keybase.txt.',
          icon: Kb.IconType.icon_file_txt_48,
          onClick: () => action('first'),
          title: 'Host a TXT file',
        },
        {
          description: 'Place a Keybase proof in your DNS records.',
          icon: Kb.IconType.icon_dns_48,
          onClick: () => action('second'),
          title: 'Set a DNS',
        },
      ]}
    />
  ))
}

export default load
