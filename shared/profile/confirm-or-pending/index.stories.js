// @flow
import * as React from 'react'
import {action, storiesOf} from '../../stories/storybook'
import {globalColors} from '../../styles'
import ConfirmOrPending from '.'

const confirm = {
  isPending: false,
  message: 'Leave your proof up so other users can identify you!',
  onReloadProfile: action('reload'),
  platform: 'twitter',
  platformIcon: 'icon-twitter-logo-48',
  platformIconOverlay: 'icon-proof-success',
  platformIconOverlayColor: globalColors.green,
  title: 'Verified!',
  titleColor: globalColors.green,
  username: 'chris',
  usernameSubtitle: '@twitter',
}

const pending = {
  isPending: true,
  platformIconOverlay: 'icon-proof-pending',
  platformIconOverlayColor: globalColors.grey,
  titleColor: globalColors.blue,
  titleText: 'Your proof is pending.',
}

const load = () => {
  storiesOf('Profile/Confirm-Pending', module)
    .add('Twitter', () => <ConfirmOrPending {...confirm} platform="twitter" />)
    .add('Reddit', () => <ConfirmOrPending {...confirm} platform="reddit" />)
    .add('Facebook', () => <ConfirmOrPending {...confirm} platform="facebook" />)
    .add('GitHub', () => <ConfirmOrPending {...confirm} platform="github" />)
    .add('Pending Hacker News', () => (
      <ConfirmOrPending
        {...confirm}
        {...pending}
        platform="hackernews"
        message="Hacker News caches its bios, so it might be a few hours before you can verify your proof. Check back later."
      />
    ))
    .add('Confirm Bitcoin', () => (
      <ConfirmOrPending
        {...confirm}
        platform="btc"
        usernameSubtitle={undefined}
        message="Your Bitcoin address has now been signed onto your profile."
        title="Verified"
      />
    ))
    .add('Confirm zcash', () => (
      <ConfirmOrPending
        {...confirm}
        platform="zcash"
        usernameSubtitle={undefined}
        message="Your Zcash address has now been signed onto your profile."
        title="Verified"
      />
    ))
    .add('Pending dns', () => (
      <ConfirmOrPending
        {...confirm}
        {...pending}
        platform="dns"
        usernameSubtitle="dns"
        message="DNS proofs can take a few hours to recognize. Check back later."
      />
    ))
    .add('Confirm http', () => (
      <ConfirmOrPending
        {...confirm}
        platform="http"
        usernameSubtitle="http"
        message="Leave your proof up so other users can identify you!"
        messageSubtitle="Note: www.chriscoyne.com doesn't load over https. If you get a real SSL certificate (not self-signed) in the future, please replace this proof with a fresh one."
      />
    ))
}

export default load
