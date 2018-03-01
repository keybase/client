// @flow
import React from 'react'
import * as Types from '../../constants/types/chat2'
import {Box} from '../../common-adapters'
import {storiesOf, action} from '../../stories/storybook'
import {isMobile} from '../../constants/platform'
import ManageChannels from '.'
import EditChannel from './edit-channel'

const channels = [
  {
    description: 'General things on things.',
    name: 'general',
    selected: true,
    convID: Types.stringToConversationIDKey('1'),
  },
  {
    description: 'Random things randomly discussed.',
    name: 'random',
    selected: true,
    convID: Types.stringToConversationIDKey('2'),
  },
  {
    description: 'Revenue data worth checking',
    name: 'revenue',
    selected: false,
    convID: Types.stringToConversationIDKey('3'),
  },
  {
    description: 'Talk to the sales team',
    name: 'sales',
    selected: false,
    convID: Types.stringToConversationIDKey('4'),
  },
  {
    description: 'True discussions on true news.',
    name: 'truechannel',
    selected: false,
    convID: Types.stringToConversationIDKey('5'),
  },
  {
    description: 'Boring things not worth discussing',
    name: 'zzz',
    selected: true,
    convID: Types.stringToConversationIDKey('13'),
  },
  {
    description: 'This is a very long long long description to test that things flow correctly',
    name: 'superlonglonglongnameforachannel',
    selected: true,
    convID: Types.stringToConversationIDKey('21'),
  },
]

const load = () => {
  storiesOf('Chat/Teams', module)
    .add('ManageChannels', () => (
      <Box style={{minWidth: isMobile ? undefined : 400, width: '100%'}}>
        <ManageChannels
          teamname="stripe.usa"
          numChannels={23}
          channels={channels}
          onClose={action('onClose')}
          onToggle={action('onToggle')}
          onEdit={action('onEdit')}
          onCreate={action('onCreate')}
          unsavedSubscriptions={false}
          onSaveSubscriptions={action('onSaveSubscriptions')}
          onClickChannel={action('onClickChannel')}
          waitingForSave={false}
          nextChannelState={channels.reduce((acc, c) => {
            acc[c.name] = c.selected
            return acc
          }, {})}
        />
      </Box>
    ))
    .add('ManageChannels - Unsaved Subscription', () => (
      <Box style={{minWidth: isMobile ? undefined : 400, width: '100%'}}>
        <ManageChannels
          teamname="stripe.usa"
          numChannels={23}
          channels={channels}
          onClose={action('onClose')}
          onToggle={action('onToggle')}
          onEdit={action('onEdit')}
          onCreate={action('onCreate')}
          unsavedSubscriptions={true}
          onSaveSubscriptions={action('onSaveSubscriptions')}
          onClickChannel={action('onClickChannel')}
          waitingForSave={false}
          nextChannelState={channels.reduce((acc, c) => {
            acc[c.name] = c.selected
            return acc
          }, {})}
        />
      </Box>
    ))
    .add('EditChannel', () => (
      <Box style={toPlatformStyle(editChannelStyle)}>
        <EditChannel
          onBack={action('onBack')}
          teamname={'stripe.usa'}
          channelName={'takeover'}
          topic={''}
          onCancel={action('onCancel')}
          onSave={action('onSave')}
          onConfirmedDelete={action('onConfirmedDelete')}
          showDelete={true}
          deleteRenameDisabled={false}
          waitingForSave={false}
        />
      </Box>
    ))
    .add('EditChannel - general', () => (
      <Box style={toPlatformStyle(editChannelStyle)}>
        <EditChannel
          onBack={action('onBack')}
          teamname={'stripe.usa'}
          channelName={'general'}
          topic={''}
          onCancel={action('onCancel')}
          onSave={action('onSave')}
          onConfirmedDelete={action('onConfirmedDelete')}
          showDelete={true}
          deleteRenameDisabled={true}
          waitingForSave={false}
        />
      </Box>
    ))
}

const toPlatformStyle = styleOpts => ({...styleOpts.common, ...styleOpts[isMobile ? 'mobile' : 'desktop']})

const editChannelStyle = {
  common: {},
  mobile: {
    width: '100%',
  },
  desktop: {
    width: 700,
    border: 'black solid 1px',
  },
}

export default load
