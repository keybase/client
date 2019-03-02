// @flow
import * as React from 'react'
import * as Sb from '../../../stories/storybook'
import ProofsList from './index'

const props = {
  filter: '',
  onBack: Sb.action('onBack'),
  onClickLearn: Sb.action('onClickLearn'),
  onSetFilter: (filter: string) => Sb.action(`onSetFilter: ${filter}`),
  providerClicked: (name: string) => Sb.action(`providerClicked: ${name}`),
  providers: [
    {
      desc: '',
      icon: 'icon-website-32',
      name: 'Your own website',
      new: false,
    },
    {
      desc: 'twitter.com',
      icon: 'icon-twitter-logo-32',
      name: 'Twitter',
      new: false,
    },
    {
      desc: 'github.com',
      icon: 'icon-github-logo-32',
      name: 'Github',
      new: false,
    },
    {
      desc: 'linkedin.com',
      icon: 'icon-placeholder-avatar-32',
      name: 'LinkedIn',
      new: false,
    },
    {
      desc: 'Mastodon instance',
      icon: 'icon-placeholder-avatar-32',
      name: 'boardgames.social',
      new: false,
    },
    {
      desc: 'Mastodon instance',
      icon: 'icon-placeholder-avatar-32',
      name: 'mastodon.social',
      new: false,
    },
    {
      desc: 'Mastodon instance',
      icon: 'icon-placeholder-avatar-32',
      name: 'hackers.town',
      new: true,
    },
  ],
}

const load = () => {
  Sb.storiesOf('Profile/Profile', module).add('Proof Providers List', () => <ProofsList {...props} />)
}

export default load
