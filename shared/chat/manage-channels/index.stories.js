// @flow
import React from 'react'
import {Box} from '../../common-adapters'
import {storiesOf, action} from '../../stories/storybook'
import {isMobile} from '../../constants/platform'
import ManageChannels from '.'

const channels = [
  {
    description: 'General things on things.',
    name: 'general',
    selected: true,
  },
  {
    description: 'Random things randomly discussed.',
    name: 'random',
    selected: true,
  },
  {
    description: 'Revenue data worth checking',
    name: 'revenue',
    selected: false,
  },
  {
    description: 'Talk to the sales team',
    name: 'sales',
    selected: false,
  },
  {
    description: 'True discussions on true news.',
    name: 'truechannel',
    selected: false,
  },
  {
    description: 'Boring things not worth discussing',
    name: 'zzz',
    selected: true,
  },
  {
    description: 'This is a very long long long description to test that things flow correctly',
    name: 'superlonglonglongnameforachannel',
    selected: true,
  },
]

const load = () => {
  storiesOf('Chat/Teams', module).add('ManageChannels', () => (
    <Box style={{minWidth: isMobile ? undefined : 400, width: '100%'}}>
      <ManageChannels
        teamname="stripe.usa"
        numChannels={23}
        channels={channels}
        onClose={action('onClose')}
        onToggle={action('onToggle')}
        onCreate={action('onCreate')}
      />
    </Box>
  ))
}

export default load
