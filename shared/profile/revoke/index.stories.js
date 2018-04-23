// @flow
import * as React from 'react'
import {action, storiesOf} from '../../stories/storybook'
import Revoke from '.'

const props = {
  onCancel: action('onCancel'),
  onRevoke: action('onRevoke'),
  platformHandle: 'malgorithms',
}

const propsTwitter = {
  ...props,
  platform: 'twitter',
  platformHandle: 'alexrwendland',
}

const load = () => {
  storiesOf('Profile/Revoke', module)
    .add('Twitter', () => <Revoke {...propsTwitter} platform="twitter" />)
    .add('Twitter waiting', () => <Revoke {...propsTwitter} platform="twitter" isWaiting={true} />)
    .add('Twitter error', () => (
      <Revoke
        {...propsTwitter}
        platform="twitter"
        errorMessage={'There was an error revoking your proof. You can click the button to try again.'}
      />
    ))
    .add('Reddit', () => <Revoke {...props} platform="reddit" />)
    .add('Facebook', () => <Revoke {...props} platform="facebook" />)
    .add('GitHub', () => <Revoke {...props} platform="github" />)
    .add('Hacker News', () => <Revoke {...props} platform="hackernews" />)
    .add('Bitcoin', () => (
      <Revoke {...props} platformHandle="1BjgMvwVkpmmJ5HFGZ3L3H1G6fcKLNGT5h" platform="btc" />
    ))
    .add('DNS', () => <Revoke {...props} platform="dns" platformHandle="chriscoyne.com" />)
    .add('Website', () => <Revoke {...props} platform="http" platformHandle="chriscoyne.com" />)
    .add('HTTPS', () => <Revoke {...props} platform="https" platformHandle="chriscoyne.com" />)
    .add('Zcash', () => <Revoke {...props} platform="zcash" platformHandle="1234-fake" />)
}

export default load
