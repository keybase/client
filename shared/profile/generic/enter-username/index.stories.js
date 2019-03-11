// @flow
import * as React from 'react'
import * as Sb from '../../../stories/storybook'
import EnterUsername from '.'

const props = {
  onBack: Sb.action('onBack'),
  onChangeUsername: Sb.action('onChangeUsername'),
  onSubmit: Sb.action('onSubmit'),
  serviceIcon: [
    {path: 'https://keybase.io/images/paramproofs/services/twitter/logo_black_16.png', width: 16},
    {path: 'https://keybase.io/images/paramproofs/services/twitter/logo_black_16@2x.png', width: 32},
  ],
  serviceIconFull: [
    {path: 'https://keybase.io/images/paramproofs/services/twitter/logo_full_64.png', width: 64},
    {path: 'https://keybase.io/images/paramproofs/services/twitter/logo_full_64@2x.png', width: 128},
  ],
  serviceName: 'boardgames.social',
  serviceSub: 'Mastodon instance',
  unreachable: false,
  username: '',
}

const load = () => {
  Sb.storiesOf('Profile/Generic Proofs/Enter username', module)
    .add('Empty', () => <EnterUsername {...props} />)
    .add('Prefilled', () => <EnterUsername {...props} username="ayoubd" />)
}

export default load
