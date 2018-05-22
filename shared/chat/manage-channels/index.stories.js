// @flow
import React from 'react'
import * as ChatTypes from '../../constants/types/chat2'
import * as PropProviders from '../../stories/prop-providers'
import * as Types from '../../constants/types/teams'
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
    convID: ChatTypes.stringToConversationIDKey('1'),
  },
  {
    description: 'Random things randomly discussed.',
    name: 'random',
    selected: true,
    convID: ChatTypes.stringToConversationIDKey('2'),
  },
  {
    description: 'Revenue data worth checking',
    name: 'revenue',
    selected: false,
    convID: ChatTypes.stringToConversationIDKey('3'),
  },
  {
    description: 'Talk to the sales team',
    name: 'sales',
    selected: false,
    convID: ChatTypes.stringToConversationIDKey('4'),
  },
  {
    description: 'True discussions on true news.',
    name: 'truechannel',
    selected: false,
    convID: ChatTypes.stringToConversationIDKey('5'),
  },
  {
    description: 'Boring things not worth discussing',
    name: 'zzz',
    selected: true,
    convID: ChatTypes.stringToConversationIDKey('13'),
  },
  {
    description: 'This is a very long long long description to test that things flow correctly',
    name: 'superlonglonglongnameforachannel',
    selected: true,
    convID: ChatTypes.stringToConversationIDKey('21'),
  },
]

const channelState = channels.reduce((acc: Types.ChannelMembershipState, c) => {
  acc[c.convID] = c.selected
  return acc
}, {})

const provider = PropProviders.compose(
  PropProviders.Usernames(['max', 'cnojima', 'cdixon'], 'ayoubd'),
  PropProviders.Avatar(['following', 'both'], ['followers', 'both'])
)

const load = () => {
  storiesOf('Chat/Teams', module)
    .addDecorator(provider)
    .add('ManageChannels', () => (
      <Box style={{minWidth: isMobile ? undefined : 400, width: '100%'}}>
        <ManageChannels
          teamname="stripe.usa"
          numChannels={23}
          canEditChannels={true}
          canCreateChannels={true}
          channels={channels}
          onClose={action('onClose')}
          onToggle={action('onToggle')}
          onEdit={action('onEdit')}
          onCreate={action('onCreate')}
          unsavedSubscriptions={false}
          onSaveSubscriptions={action('onSaveSubscriptions')}
          onClickChannel={action('onClickChannel')}
          nextChannelState={channelState}
          waitingForGet={false}
        />
      </Box>
    ))
    .add('ManageChannels - no channels', () => (
      <Box style={{minWidth: isMobile ? undefined : 400, width: '100%'}}>
        <ManageChannels
          teamname="stripe.usa"
          numChannels={23}
          canEditChannels={true}
          canCreateChannels={true}
          channels={[]}
          onClose={action('onClose')}
          onToggle={action('onToggle')}
          onEdit={action('onEdit')}
          onCreate={action('onCreate')}
          unsavedSubscriptions={false}
          onSaveSubscriptions={action('onSaveSubscriptions')}
          onClickChannel={action('onClickChannel')}
          nextChannelState={channelState}
          waitingForGet={false}
        />
      </Box>
    ))
    .add('ManageChannels - Unsaved Subscription', () => (
      <Box style={{minWidth: isMobile ? undefined : 400, width: '100%'}}>
        <ManageChannels
          teamname="stripe.usa"
          numChannels={23}
          canEditChannels={false}
          canCreateChannels={false}
          channels={channels}
          onClose={action('onClose')}
          onToggle={action('onToggle')}
          onEdit={action('onEdit')}
          onCreate={action('onCreate')}
          unsavedSubscriptions={true}
          onSaveSubscriptions={action('onSaveSubscriptions')}
          onClickChannel={action('onClickChannel')}
          nextChannelState={channelState}
          waitingForGet={false}
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
          waitingForGetInfo={false}
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
          waitingForGetInfo={false}
        />
      </Box>
    ))
    .add('EditChannel - loading', () => (
      <Box style={toPlatformStyle(editChannelStyle)}>
        <EditChannel
          onBack={action('onBack')}
          teamname={'stripe.usa'}
          channelName={''}
          topic={''}
          onCancel={action('onCancel')}
          onSave={action('onSave')}
          onConfirmedDelete={action('onConfirmedDelete')}
          showDelete={true}
          deleteRenameDisabled={false}
          waitingForGetInfo={true}
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
