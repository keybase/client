import * as React from 'react'
import * as Sb from '../../stories/storybook'
import * as ChatTypes from '../../constants/types/chat2'
import * as Types from '../../constants/types/teams'
import {Box} from '../../common-adapters'
import {isMobile} from '../../constants/platform'
import ManageChannels from '.'
import EditChannel from './edit-channel'
import {formatTimeRelativeToNow} from '../../util/timestamp'

const origin = new Date().getTime()
const mtimeHuman = formatTimeRelativeToNow(origin)

const channels = [
  {
    convID: ChatTypes.stringToConversationIDKey('1'),
    description: 'General things on things.',
    hasAllMembers: true,
    mtimeHuman,
    name: 'general',
    numParticipants: 5,
    selected: true,
  },
  {
    convID: ChatTypes.stringToConversationIDKey('2'),
    description: 'Random things randomly discussed.',
    hasAllMembers: true,
    mtimeHuman,
    name: 'random',
    numParticipants: 5,
    selected: true,
  },
  {
    convID: ChatTypes.stringToConversationIDKey('3'),
    description: 'Revenue data worth checking',
    hasAllMembers: true,
    mtimeHuman,
    name: 'revenue',
    numParticipants: 5,
    selected: false,
  },
  {
    convID: ChatTypes.stringToConversationIDKey('4'),
    description: 'Talk to the sales team',
    hasAllMembers: true,
    mtimeHuman,
    name: 'sales',
    numParticipants: 5,
    selected: false,
  },
  {
    convID: ChatTypes.stringToConversationIDKey('5'),
    description: 'True discussions on true news.',
    hasAllMembers: true,
    mtimeHuman,
    name: 'truechannel',
    numParticipants: 5,
    selected: false,
  },
  {
    convID: ChatTypes.stringToConversationIDKey('13'),
    description: 'Boring things not worth discussing',
    hasAllMembers: false,
    mtimeHuman,
    name: 'zzz',
    numParticipants: 1,
    selected: true,
  },
  {
    convID: ChatTypes.stringToConversationIDKey('21'),
    description: 'This is a very long long long description to test that things flow correctly',
    hasAllMembers: false,
    mtimeHuman,
    name: 'superlonglonglongnameforachannel',
    numParticipants: 2,
    selected: true,
  },
]

const channelState = channels.reduce((acc: Types.ChannelMembershipState, c) => {
  acc[c.convID] = c.selected
  return acc
}, {})

const load = () => {
  Sb.storiesOf('Chat/Teams', module)
    .add('ManageChannels', () => (
      <Box style={{minWidth: isMobile ? undefined : 400, width: '100%'}}>
        <ManageChannels
          teamname="stripe.usa"
          canEditChannels={true}
          canCreateChannels={true}
          channels={channels}
          onClose={Sb.action('onClose')}
          onToggle={Sb.action('onToggle')}
          onEdit={Sb.action('onEdit')}
          onCreate={Sb.action('onCreate')}
          unsavedSubscriptions={false}
          onSaveSubscriptions={Sb.action('onSaveSubscriptions')}
          onClickChannel={Sb.action('onClickChannel')}
          nextChannelState={channelState}
          waitingForGet={false}
          waitingKey="test"
        />
      </Box>
    ))
    .add('ManageChannels - no channels', () => (
      <Box style={{minWidth: isMobile ? undefined : 400, width: '100%'}}>
        <ManageChannels
          teamname="stripe.usa"
          canEditChannels={true}
          canCreateChannels={true}
          channels={[]}
          onClose={Sb.action('onClose')}
          onToggle={Sb.action('onToggle')}
          onEdit={Sb.action('onEdit')}
          onCreate={Sb.action('onCreate')}
          unsavedSubscriptions={false}
          onSaveSubscriptions={Sb.action('onSaveSubscriptions')}
          onClickChannel={Sb.action('onClickChannel')}
          nextChannelState={channelState}
          waitingForGet={false}
          waitingKey="test"
        />
      </Box>
    ))
    .add('ManageChannels - Unsaved Subscription', () => (
      <Box style={{minWidth: isMobile ? undefined : 400, width: '100%'}}>
        <ManageChannels
          teamname="stripe.usa"
          canEditChannels={false}
          canCreateChannels={false}
          channels={channels}
          onClose={Sb.action('onClose')}
          onToggle={Sb.action('onToggle')}
          onEdit={Sb.action('onEdit')}
          onCreate={Sb.action('onCreate')}
          unsavedSubscriptions={true}
          onSaveSubscriptions={Sb.action('onSaveSubscriptions')}
          onClickChannel={Sb.action('onClickChannel')}
          nextChannelState={channelState}
          waitingForGet={false}
          waitingKey="test"
        />
      </Box>
    ))
    .add('EditChannel', () => (
      <Box style={toPlatformStyle(editChannelStyle)}>
        <EditChannel
          errorText=""
          onSetChannelCreationError={Sb.action('onSetChannelCreationError')}
          onSaveSuccess={Sb.action('onSaveSuccess')}
          waitingOnSave={false}
          teamname="stripe.usa"
          channelName="takeover"
          topic=""
          title="Edit #takeover"
          onCancel={Sb.action('onCancel')}
          onSave={Sb.action('onSave')}
          onConfirmedDelete={Sb.action('onConfirmedDelete')}
          showDelete={true}
          deleteRenameDisabled={false}
          waitingForGetInfo={false}
          loadChannelInfo={Sb.action('loadChannelInfo')}
        />
      </Box>
    ))
    .add('EditChannel - general', () => (
      <Box style={toPlatformStyle(editChannelStyle)}>
        <EditChannel
          errorText=""
          onSetChannelCreationError={Sb.action('onSetChannelCreationError')}
          onSaveSuccess={Sb.action('onSaveSuccess')}
          waitingOnSave={false}
          teamname="stripe.usa"
          channelName="general"
          topic=""
          title="Edit #general"
          onCancel={Sb.action('onCancel')}
          onSave={Sb.action('onSave')}
          onConfirmedDelete={Sb.action('onConfirmedDelete')}
          showDelete={true}
          deleteRenameDisabled={true}
          waitingForGetInfo={false}
          loadChannelInfo={Sb.action('loadChannelInfo')}
        />
      </Box>
    ))
    .add('EditChannel - loading', () => (
      <Box style={toPlatformStyle(editChannelStyle)}>
        <EditChannel
          errorText=""
          onSetChannelCreationError={Sb.action('onSetChannelCreationError')}
          onSaveSuccess={Sb.action('onSaveSuccess')}
          waitingOnSave={false}
          teamname="stripe.usa"
          channelName=""
          topic=""
          title="Edit #"
          onCancel={Sb.action('onCancel')}
          onSave={Sb.action('onSave')}
          onConfirmedDelete={Sb.action('onConfirmedDelete')}
          showDelete={true}
          deleteRenameDisabled={false}
          waitingForGetInfo={true}
          loadChannelInfo={Sb.action('loadChannelInfo')}
        />
      </Box>
    ))
    .add('EditChannel - loading with error', () => (
      <Box style={toPlatformStyle(editChannelStyle)}>
        <EditChannel
          errorText="invalid channel name"
          onSetChannelCreationError={Sb.action('onSetChannelCreationError')}
          onSaveSuccess={Sb.action('onSaveSuccess')}
          waitingOnSave={false}
          teamname="stripe.usa"
          channelName=""
          topic=""
          title="Edit #"
          onCancel={Sb.action('onCancel')}
          onSave={Sb.action('onSave')}
          onConfirmedDelete={Sb.action('onConfirmedDelete')}
          showDelete={true}
          deleteRenameDisabled={false}
          waitingForGetInfo={true}
          loadChannelInfo={Sb.action('loadChannelInfo')}
        />
      </Box>
    ))
}

const toPlatformStyle = styleOpts => ({...styleOpts.common, ...styleOpts[isMobile ? 'mobile' : 'desktop']})

const editChannelStyle = {
  common: {},
  desktop: {
    border: 'black solid 1px',
    width: 700,
  },
  mobile: {
    width: '100%',
  },
}

export default load
