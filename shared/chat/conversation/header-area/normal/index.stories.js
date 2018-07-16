// @flow
import * as React from 'react'
import {action, storiesOf, createPropProvider} from '../../../../stories/storybook'
import * as PropProviders from '../../../../stories/prop-providers'
import {UsernameHeader, ChannelHeader} from '.'

const provider = createPropProvider(PropProviders.Usernames())

const defaultProps = {
  badgeNumber: 1,
  canOpenInfoPanel: true,
  channelName: 'nyc',
  infoPanelOpen: false,
  muted: false,
  onBack: action('onBack'),
  onCancelPending: null, // action('onCancelPending'),
  onOpenFolder: action('onOpenFolder'),
  onShowProfile: action('onShowProfile'),
  onToggleInfoPanel: action('onToggleInfoPanel'),
  participants: ['joshblum', 'ayoubd'],
  smallTeam: true,
  teamName: 'keybase',
}

const load = () => {
  storiesOf('Chat/Header', module)
    .addDecorator(provider)
    .add('Username Header', () => <UsernameHeader {...defaultProps} />)
    .add('Username Header with info panel open', () => (
      <UsernameHeader {...defaultProps} infoPanelOpen={true} />
    ))
    .add('Username Header muted', () => <UsernameHeader {...defaultProps} muted={true} />)
    .add('Channel Header for small team', () => <ChannelHeader {...defaultProps} />)
    .add('Channel Header for big team', () => <ChannelHeader {...defaultProps} smallTeam={false} />)
}

export default load
