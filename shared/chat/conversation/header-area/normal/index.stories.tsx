import * as React from 'react'
import * as Sb from '../../../../stories/storybook'
import {UsernameHeader, ChannelHeader, PhoneOrEmailHeader} from '.'

const defaultProps = {
  badgeNumber: 1,
  channelName: 'nyc',
  contactNames: {},
  infoPanelOpen: false,
  muted: false,
  onBack: Sb.action('onBack'),
  onOpenFolder: Sb.action('onOpenFolder'),
  onShowProfile: Sb.action('onShowProfile'),
  onToggleInfoPanel: Sb.action('onToggleInfoPanel'),
  onToggleThreadSearch: Sb.action('onToggleThreadSearch'),
  participants: ['joshblum', 'ayoubd'],
  pendingWaiting: false,
  smallTeam: true,
  teamName: 'keybase',
  unMuteConversation: Sb.action('unMuteConversation'),
}
const phones = ['ayoubd', '+15558675309@phone']
const contactNames = {'+15558675309@phone': 'Max Goodman'}

const load = () => {
  Sb.storiesOf('Chat/Header', module)
    .add('Username Header', () => <UsernameHeader {...defaultProps} />)
    .add('Username Header with info panel open', () => (
      <UsernameHeader {...defaultProps} infoPanelOpen={true} />
    ))
    .add('Username Header muted', () => <UsernameHeader {...defaultProps} muted={true} />)
    .add('Channel Header for small team', () => <ChannelHeader {...defaultProps} />)
    .add('Channel Header for big team', () => <ChannelHeader {...defaultProps} smallTeam={false} />)
    .add('Phone header', () => (
      <PhoneOrEmailHeader {...defaultProps} participants={phones} contactNames={contactNames} />
    ))
}

export default load
