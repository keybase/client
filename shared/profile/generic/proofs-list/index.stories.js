// @flow
import * as React from 'react'
import * as Sb from '../../../stories/storybook'
import ProofsList from './index'

const icon = [
  {path: 'https://keybase.io/images/paramproofs/services/twitter/logo_full_64.png', width: 32},
  {path: 'https://keybase.io/images/paramproofs/services/twitter/logo_full_64@2x.png', width: 64},
]

const props = {
  onBack: Sb.action('onBack'),
  onClickLearn: Sb.action('onClickLearn'),
  providerClicked: (name: string) => Sb.action(`providerClicked: ${name}`),
  providers: [
    {
      desc: '',
      icon,
      name: 'Your own website',
      new: false,
    },
    {
      desc: 'twitter.com',
      icon,
      name: 'Twitter',
      new: false,
    },
    {
      desc: 'github.com',
      icon,
      name: 'Github',
      new: false,
    },
    {
      desc: 'linkedin.com',
      icon,
      name: 'LinkedIn',
      new: false,
    },
    {
      desc: 'Mastodon instance',
      icon,
      name: 'boardgames.social',
      new: false,
    },
    {
      desc: 'Mastodon instance',
      icon,
      name: 'mastodon.social',
      new: false,
    },
    {
      desc: 'Mastodon instance',
      icon,
      name: 'hackers.town',
      new: true,
    },
    {
      desc: 'Mastodon instance',
      icon,
      name: 'rockclimbing.social',
      new: false,
    },
    {
      desc: 'Mastodon instance',
      icon,
      name: 'phrenology.social',
      new: true,
    },
    {
      desc: 'Mastodon instance',
      icon,
      name: 'boardgames.town',
      new: true,
    },
  ],
}

const load = () => {
  Sb.storiesOf('Profile/Profile', module).add('Proof Providers List', () => <ProofsList {...props} />)
}

export default load
