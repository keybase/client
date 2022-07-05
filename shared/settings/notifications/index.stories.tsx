import * as React from 'react'
import * as Sb from '../../stories/storybook'
import Notifications from '.'

const props = {
  allowEdit: true,
  groups: new Map([
    [
      'app_push',
      {
        settings: [
          {
            description: 'when someone follows me',
            name: 'follow',
            subscribed: true,
          },
        ],
        unsub: false,
      },
    ],
    [
      'email',
      {
        settings: [
          {
            description: 'when someone follows me',
            name: 'follow',
            subscribed: true,
          },
          {
            description: 'when someone I follow on Twitter joins',
            name: 'twitter_friend_joined',
            subscribed: true,
          },
          {
            description: 'when the Keybase filesystem needs my attention',
            name: 'filesystem_attention',
            subscribed: true,
          },
          {
            description: 'Keybase news, once in a great while',
            name: 'newsletter',
            subscribed: true,
          },
        ],
        unsub: false,
      },
    ],
  ]),
  mobileHasPermissions: true,
  onClickYourAccount: Sb.action('yourAccount'),
  onRefresh: Sb.action('onRefresh'),
  onSave: Sb.action('onSave'),
  onToggle: Sb.action('onToggle'),
  onToggleUnsubscribeAll: Sb.action('onToggleUnsubscribeAll'),
  showEmailSection: true,
  waitingForResponse: false,
}

const unsubProps = {...props}
unsubProps.groups.get('email')!.unsub = true

const load = () => {
  Sb.storiesOf('Settings/Notifications', module)
    .add('Normal', () => <Notifications {...props} />)
    // TODO this doesn't seem to work
    .add('Unsuball', () => <Notifications {...unsubProps} />)
}

export default load
