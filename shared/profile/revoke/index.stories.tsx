import * as React from 'react'
import {action, storiesOf} from '../../stories/storybook'
import Revoke from '.'

const makeIcons = (platform: string) => [
  {path: `https://keybase.io/images/paramproofs/services/${platform}/logo_full_64.png`, width: 64},
  {path: `https://keybase.io/images/paramproofs/services/${platform}/logo_full_64@2x.png`, width: 128},
]

const props = {
  isWaiting: false,
  onCancel: action('onCancel'),
  onRevoke: action('onRevoke'),
  platformHandle: 'malgorithms',
}

const propsTwitter = {
  ...props,
  icon: makeIcons('twitter'),
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
    .add('Reddit', () => <Revoke {...props} platform="reddit" icon={makeIcons('reddit')} />)
    .add('GitHub', () => <Revoke {...props} platform="github" icon={makeIcons('github')} />)
    .add('Hacker News', () => <Revoke {...props} platform="hackernews" icon={makeIcons('hackernews')} />)
    .add('Bitcoin', () => (
      <Revoke
        {...props}
        platformHandle="1BjgMvwVkpmmJ5HFGZ3L3H1G6fcKLNGT5h"
        platform="btc"
        icon={makeIcons('btc')}
      />
    ))
    .add('DNS', () => (
      <Revoke {...props} platform="dns" platformHandle="chriscoyne.com" icon={makeIcons('web')} />
    ))
    .add('Website', () => (
      <Revoke {...props} platform="http" platformHandle="chriscoyne.com" icon={makeIcons('web')} />
    ))
    .add('HTTPS', () => (
      <Revoke {...props} platform="https" platformHandle="chriscoyne.com" icon={makeIcons('web')} />
    ))
    .add('Zcash', () => (
      <Revoke {...props} platform="zcash" platformHandle="1234-fake" icon={makeIcons('zcash')} />
    ))
}

export default load
