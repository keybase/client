// @flow
import * as React from 'react'
import {action, storiesOf, PropProviders} from '../../../../stories/storybook'
import {UsernameHeader, ChannelHeader} from '.'

const defaultProps = {
  badgeNumber: 1,
  canOpenInfoPanel: true,
  channelName: 'nyc',
  infoPanelOpen: false,
  muted: false,
  onBack: action('onBack'),
  onCancelPending: null,
  onOpenFolder: action('onOpenFolder'),
  onShowProfile: action('onShowProfile'),
  onToggleInfoPanel: action('onToggleInfoPanel'),
  participants: ['joshblum', 'ayoubd'],
  smallTeam: true,
  teamName: 'keybase',
}

const isPendingProps = {
  canOpenInfoPanel: false,
  onCancelPending: action('onCancelPending'),
  onOpenFolder: null,
}

const load = () => {
  storiesOf('Chat/Header', module)
    .addDecorator(PropProviders.createPropProviderWithCommon())
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
