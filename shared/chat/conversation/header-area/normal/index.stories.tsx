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
    .add('Username Header - long', () => (
      <UsernameHeader {...defaultProps} participants={['sjdfiowehfuihewfbdfjkvbeiuwewriovunweoi']} />
    ))
    .add('Usernames Header', () => (
      <UsernameHeader {...defaultProps} participants={['apple', 'banana', 'cherry']} />
    ))
    .add('Usernames Header - long', () => (
      <UsernameHeader
        {...defaultProps}
        participants={[
          'apple',
          'banana',
          'cherry',
          'dragon_fruit',
          'eggfruit',
          'fig',
          'grapefruit',
          'honeydew',
          'indian_prune',
          'jackfruit',
        ]}
      />
    ))
    .add('Username Header with info panel open', () => (
      <UsernameHeader {...defaultProps} infoPanelOpen={true} />
    ))
    .add('Username Header muted', () => <UsernameHeader {...defaultProps} muted={true} />)
    .add('Channel Header for small team', () => <ChannelHeader {...defaultProps} />)
    .add('Channel Header for small team - long', () => (
      <ChannelHeader {...defaultProps} teamName="fuewihfioewuhiowvhiowefhuweifohioweu" />
    ))
    .add('Channel Header for big team', () => <ChannelHeader {...defaultProps} smallTeam={false} />)
    .add('Channel Header for big team - long', () => (
      <ChannelHeader {...defaultProps} smallTeam={false} channelName="uweiohfiwehfiowehfioweuhf" />
    ))
    .add('Phone header', () => (
      <PhoneOrEmailHeader {...defaultProps} participants={phones} contactNames={contactNames} />
    ))
}

export default load
