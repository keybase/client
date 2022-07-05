import * as React from 'react'
import * as Sb from '../../../stories/storybook'
import EnterUsername from '.'

const props = {
  error: '',
  onBack: Sb.action('onBack'),
  onCancel: Sb.action('onCancel'),
  onChangeUsername: Sb.action('onChangeUsername'),
  onContinue: Sb.action('onContinue'),
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
  serviceSuffix: '@boardgames.social',
  submitButtonLabel: 'Authorize on boardgames.social',
  unreachable: false,
  username: '',
  waiting: false,
}

const load = () => {
  Sb.storiesOf('Profile/Generic Proofs/Enter username', module)
    .add('Empty', () => <EnterUsername {...props} />)
    .add('Prefilled', () => <EnterUsername {...props} username="ayoubd" />)
    .add('Error', () => (
      <EnterUsername {...props} username="(#$&*(" error="Wrong username format. Please try again." />
    ))
    .add('Unreachable', () => <EnterUsername {...props} username="ayoubd" unreachable={true} />)
}

export default load
