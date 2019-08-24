import * as React from 'react'
import Notifications from '.'
import {action, storiesOf} from '../../stories/storybook'

const props = {
  allowEdit: true,
  groups: {
    app_push: {
      settings: [
        {
          description: 'when someone follows me',
          name: 'follow',
          subscribed: true,
        },
      ],
      unsubscribedFromAll: false,
    },
    email: {
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
      unsubscribedFromAll: false,
    },
  },
  mobileHasPermissions: true,
  onClickYourAccount: action('yourAccount'),
  onRefresh: action('onRefresh'),
  onSave: action('onSave'),
  onToggle: action('onToggle'),
  onToggleUnsubscribeAll: action('onToggleUnsubscribeAll'),
  showEmailSection: true,
  waitingForResponse: false,
}

const unsubProps = {...props}
unsubProps.groups.email.unsubscribedFromAll = true

const load = () => {
  storiesOf('Settings/Notifications', module)
    .add('Normal', () => <Notifications {...props} />)
    // TODO this doesn't seem to work
    .add('Unsuball', () => <Notifications {...unsubProps} />)
}

export default load
