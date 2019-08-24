import * as React from 'react'
import {action, storiesOf} from '../../stories/storybook'
import ConfirmOrPending from '.'

const confirm = {
  isPending: false,
  onCancel: action('onCancel'),
  platform: 'twitter',
  platformIconOverlayColor: 'blue',
  username: 'chris',
}

const pending = {
  isPending: true,
  onCancel: action('onCancel'),
  platform: 'twitter',
  platformIconOverlayColor: 'green',
  username: 'chris',
}

const load = () => {
  storiesOf('Profile/Confirm-Pending', module)
    .add('Twitter', () => <ConfirmOrPending {...confirm} platform="twitter" />)
    .add('Reddit', () => <ConfirmOrPending {...confirm} platform="reddit" />)
    .add('Facebook', () => <ConfirmOrPending {...confirm} platform="facebook" />)
    .add('GitHub', () => <ConfirmOrPending {...confirm} platform="github" />)
    .add('Pending Hacker News', () => <ConfirmOrPending {...confirm} {...pending} platform="hackernews" />)
    .add('Confirm Bitcoin', () => <ConfirmOrPending {...confirm} platform="btc" />)
    .add('Confirm zcash', () => <ConfirmOrPending {...confirm} platform="zcash" />)
    .add('Pending dns', () => <ConfirmOrPending {...confirm} {...pending} platform="dns" />)
    .add('Confirm http', () => <ConfirmOrPending {...confirm} platform="http" />)
}

export default load
