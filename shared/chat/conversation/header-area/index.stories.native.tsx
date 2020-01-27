import * as React from 'react'
import * as Sb from '../../../stories/storybook'
import {UsernameHeader, ChannelHeader, PhoneOrEmailHeader} from './index.native'

const defaultProps = {
  badgeNumber: 1,
  channelName: 'nyc',
  contactNames: new Map(),
  muted: false,
  onBack: Sb.action('onBack'),
  onOpenFolder: Sb.action('onOpenFolder'),
  onShowInfoPanel: Sb.action('onShowInfoPanel'),
  onShowProfile: Sb.action('onShowProfile'),
  onToggleThreadSearch: Sb.action('onToggleThreadSearch'),
  participants: ['joshblum', 'ayoubd'],
  pendingWaiting: false,
  smallTeam: true,
  teamName: 'keybase',
  theirFullname: undefined,
  unMuteConversation: Sb.action('unMuteConversation'),
}
const phones = ['ayoubd', '+15558675309@phone']
const contactNames = new Map([
  ['+15558675309@phone', 'Max Goodman'],
  ['+17083585828@phone', 'Ian'],
])

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
    .add('Username Header muted', () => <UsernameHeader {...defaultProps} muted={true} />)
    .add('Channel Header for small team', () => <ChannelHeader {...defaultProps} />)
    .add('Channel Header for small team - long', () => (
      <ChannelHeader {...defaultProps} teamName="fuewihfioewuhiowvhiowefhuweifohioweu" />
    ))
    .add('Channel Header for big team', () => <ChannelHeader {...defaultProps} smallTeam={false} />)
    .add('Channel Header for big team - long', () => (
      <ChannelHeader {...defaultProps} smallTeam={false} channelName="uweiohfiwehfiowehfioweuhf" />
    ))
    .add('Phone header - no contact name', () => (
      <PhoneOrEmailHeader {...defaultProps} participants={phones} />
    ))
    .add('Phone header - contact name - first only', () => (
      <PhoneOrEmailHeader
        {...defaultProps}
        participants={['ayoubd', '+17083585828@phone']}
        contactNames={contactNames}
      />
    ))
    .add('Phone header - contact name - full name', () => (
      <PhoneOrEmailHeader {...defaultProps} participants={phones} contactNames={contactNames} />
    ))
    .add('Email Header - short', () => (
      <PhoneOrEmailHeader {...defaultProps} participants={['[max@keybase.io]@email']} />
    ))
    .add('Email Header - long', () => (
      <PhoneOrEmailHeader
        {...defaultProps}
        participants={['[extremelylongusernameataveryshortdomain@a.com]@email']}
      />
    ))
}

export default load
