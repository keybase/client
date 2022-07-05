import * as React from 'react'
import * as Sb from '../../../stories/storybook'
import ProofsList from './index'

const icon = [
  {path: 'https://keybase.io/images/paramproofs/services/twitter/logo_full_64.png', width: 32},
  {path: 'https://keybase.io/images/paramproofs/services/twitter/logo_full_64@2x.png', width: 64},
]

const props = {
  onCancel: Sb.action('onCancel'),
  onClickLearn: Sb.action('onClickLearn'),
  providerClicked: (name: string) => Sb.action(`providerClicked: ${name}`),
  providers: [
    {
      desc: '',
      icon,
      key: 'dummy key',
      name: 'Your own website',
      new: false,
    },
    {
      desc: 'twitter.com',
      icon,
      key: 'dummy key',
      name: 'Twitter',
      new: false,
    },
    {
      desc: 'github.com',
      icon,
      key: 'dummy key',
      name: 'Github',
      new: false,
    },
    {
      desc: 'linkedin.com',
      icon,
      key: 'dummy key',
      name: 'LinkedIn',
      new: false,
    },
    {
      desc: 'Mastodon instance',
      icon,
      key: 'dummy key',
      name: 'boardgames.social',
      new: false,
    },
    {
      desc: 'Mastodon instance',
      icon,
      key: 'dummy key',
      name: 'mastodon.social',
      new: false,
    },
    {
      desc: 'Mastodon instance',
      icon,
      key: 'dummy key',
      name: 'hackers.town',
      new: true,
    },
    {
      desc: 'Mastodon instance',
      icon,
      key: 'dummy key',
      name: 'rockclimbing.social',
      new: false,
    },
    {
      desc: 'Mastodon instance',
      icon,
      key: 'dummy key',
      name: 'phrenology.social',
      new: true,
    },
    {
      desc: 'Mastodon instance',
      icon,
      key: 'dummy key',
      name: 'boardgames.town',
      new: true,
    },
  ],
  title: 'Prove your...',
}

const load = () => {
  Sb.storiesOf('Profile/Profile', module).add('Proof Providers List', () => <ProofsList {...props} />)
}

export default load
