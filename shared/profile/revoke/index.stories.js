// @flow
import * as React from 'react'
import {Box} from '../../common-adapters'
import {action, storiesOf} from '../../stories/storybook'
import Render from '.'

const props = {
  onCancel: () => action('onCancel'),
  onRevoke: () => action('onRevoke'),
}

const revokeTwitter = {
  ...props,
  platform: 'twitter',
  platformHandle: 'alexrwendland',
}

  mocks: {
    'Twitter - Waiting': {...revokeTwitter, isWaiting: true},
    Reddit: {...revokeBase, platformHandle: 'malgorithms', platform: 'reddit'},
    Facebook: {...revokeBase, platformHandle: 'malgorithms', platform: 'facebook'},
    GitHub: {...revokeBase, platformHandle: 'malgorithms', platform: 'github'},
    'Hacker News': {...revokeBase, platformHandle: 'malgorithms', platform: 'hackernews'},
    Bitcoin: {...revokeBase, platformHandle: '1BjgMvwVkpmmJ5HFGZ3L3H1G6fcKLNGT5h', platform: 'btc'},
    DNS: {...revokeBase, platformHandle: 'chriscoyne.com', platform: 'dns'},
    Website: {...revokeBase, platformHandle: 'chriscoyne.com', platform: 'http'},
    'https website': {...revokeBase, platformHandle: 'chriscoyne.com', platform: 'https'},
    Zcash: {...revokeBase, platformHandle: '1234-fake', platform: 'zcash'},
  },
}

const load = () => {
  storiesOf('Profile/Revoke', module)
    .add('Twitter', () => <Revoke {...props} platform="twitter" />)
    .add('Twitter waiting', () => <Revoke {...props} platform="twitter" />)
    .add('Twitter error', () => (
      <Revoke {...props} platform="twitter"
        errorMessage={ 'There was an error revoking your proof. You can click the button to try again.'}
      />
    ))
    .add('Reddit', () => <Revoke {...props} platform="reddit" />)
    .add('Facebook', () => <Revoke {...props} platform="facebook" />)
    .add('GitHub', () => <Revoke {...props} platform="github" />)
    .add('Hacker News', () => <Revoke {...props} platform="hackernews" />)
    .add('Bitcoin', () => <Revoke {...props} platform="btc" />)
    .add('DNS', () => <Revoke {...props} platform="dns" />)
    .add('Website', () => <Revoke {...props} platform="http" />)
    .add('HTTPS', () => <Revoke {...props} platform="https" />)
    .add('Zcash', () => <Revoke {...props} platform="zcash" />)
}

export default load
