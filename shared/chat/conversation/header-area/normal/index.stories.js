// @flow
import * as React from 'react'
import * as Sb from '../../../../stories/storybook'
import {UsernameHeader, ChannelHeader} from '.'

const defaultProps = {
  badgeNumber: 1,
  canOpenInfoPanel: true,
  channelName: 'nyc',
  infoPanelOpen: false,
  muted: false,
  onBack: Sb.action('onBack'),
  onCancelPending: null,
  onOpenFolder: Sb.action('onOpenFolder'),
  onShowProfile: Sb.action('onShowProfile'),
  onToggleInfoPanel: Sb.action('onToggleInfoPanel'),
  participants: ['joshblum', 'ayoubd'],
  smallTeam: true,
  teamName: 'keybase',
}

const isPendingProps = {
  canOpenInfoPanel: false,
  onCancelPending: Sb.action('onCancelPending'),
  onOpenFolder: null,
}

const load = () => {
  Sb.storiesOf('Chat/Header', module)
    .add('Username Header', () => <UsernameHeader {...defaultProps} />)
    .add('Username Header with info panel open', () => (
      <UsernameHeader {...defaultProps} infoPanelOpen={true} />
    ))
    .add('Username Header muted', () => <UsernameHeader {...defaultProps} muted={true} />)
    .add('Username Header isPending', () => <UsernameHeader {...defaultProps} {...isPendingProps} />)
    .add('Channel Header for small team', () => <ChannelHeader {...defaultProps} />)
    .add('Channel Header for big team', () => <ChannelHeader {...defaultProps} smallTeam={false} />)
}

export default load
