// @flow
import * as React from 'react'
import * as Sb from '../../stories/storybook'
import * as Kb from '../../common-adapters'
import Tracker from './container.desktop'

const assertion = {
  assertion: '',
  metas: [],
  proofURL: '',
  siteIcon: '',
  siteURL: '',
  state: 'valid',
}

const github = {...assertion, assertion: 'githubuser@github', siteIcon: 'iconfont-identity-github'}
const twitter = {
  ...assertion,
  assertion: 'twitteruser@twitter',
  siteIcon: 'iconfont-identity-twitter',
  state: 'checking',
}
const facebook = {
  ...assertion,
  assertion: 'facebookuser@facebook',
  siteIcon: 'iconfont-identity-facebook',
  state: 'error',
}
const hackernews = {
  ...assertion,
  assertion: 'hackernewsuser@hackernews',
  siteIcon: 'iconfont-identity-hn',
  state: 'warning',
}
const reddit = {
  ...assertion,
  assertion: 'reddituser@reddit',
  siteIcon: 'iconfont-identity-reddit',
  state: 'revoked',
}
const pgp = {...assertion, assertion: 'pgpuser@pgp', siteIcon: 'iconfont-identity-pgp'}
const https = {...assertion, assertion: 'httpsuser@https', siteIcon: 'iconfont-identity-website'}
const rooter = {...assertion, assertion: 'rooteruser@rooter', siteIcon: 'iconfont-thunderbolt'}
const dns = {...assertion, assertion: 'dnsuser@dns', siteIcon: 'iconfont-identity-website'}

const shorter = a => ({
  ...a,
  assertion: a.assertion
    .split('.')
    .map((s, idx) => (idx ? s : s.substr(0, s.length - 2)))
    .join('.'),
})
const web1 = {
  ...assertion,
  assertion: 'thelongestdomainnameintheworldandthensomeandthensomemoreandmore.com@https',
  siteIcon: 'iconfont-identity-website',
}
const web2 = shorter(web1)
const web3 = shorter(web2)
const web4 = shorter(web3)
const web5 = shorter(web4)

const allAssertions = [
  github,
  twitter,
  facebook,
  hackernews,
  rooter,
  reddit,
  pgp,
  https,
  dns,
  web1,
  web2,
  web3,
  web4,
  web5,
]
const props = {
  assertions: allAssertions.map(a => a.assertion),
  bio:
    'Etsy photo booth mlkshk semiotics, 8-bit literally slow-carb keytar bushwick +1. Plaid migas etsy yuccie, locavore street art mlkshk lumbersexual. Literally microdosing pug disrupt iPhone raw denim, quinoa meggings kitsch.',
  followThem: false,
  followersCount: 1871,
  followingCount: 356,
  followsYou: false,
  fullname: 'Gabriel Handford',
  location: 'San Francisco, California, USA, Earth, Milky Way',
  publishedTeams: [],
  reason: 'You accessed a private folder with gabrielh.',
  state: 'valid',
  username: 'darksim905',
}

const provider = Sb.createPropProviderWithCommon({
  Assertion: p => {
    const a = allAssertions.find(a => a.assertion === p.assertion)
    if (!a) {
      throw new Error('cant happen')
    }
    const parts = a.assertion.split('@')
    let prefix = '@'
    switch (parts[1]) {
      case 'dns':
      case 'http':
      case 'https':
        prefix = ''
        break
    }
    const site = `${prefix}${parts[1]}`
    return {
      metas: a.metas,
      onShowProof: Sb.action('onShowProof'),
      onShowSite: Sb.action('onShowSite'),
      onShowUserOnSite: Sb.action('onShowUserOnSite'),
      proofURL: a.proofURL,
      site,
      siteIcon: a.siteIcon,
      siteURL: a.siteURL,
      state: a.state,
      username: parts[0],
      ...p.storyProps,
    }
  },
  Bio: p => ({
    ...props,
    ...p,
    bio:
      p.username === 'longbio'
        ? 'This is a very very very very very very very very very very very very very very very very very very very very very very very very very very very very long bio'
        : props.bio,
    fullname:
      p.username === 'longfullname'
        ? 'mr longlonlonglonlonglonlonglonlonglonggggglonglonglongnarm squire the third'
        : props.fullname,
    location:
      p.username === 'longlocation'
        ? 'This is a very very very very very very very very very very very very very very very very very very very very very very very very very very very very long location'
        : props.location,
  }),
  Tracker2: p => ({
    ...props,
    ...p,
    ...p.storyProps,
  }),
})

const load = () => {
  Sb.storiesOf('Tracker2', module)
    .addDecorator(provider)
    .addDecorator(story => (
      <Kb.Box2 direction="vertical" style={wrapper}>
        {story()}
      </Kb.Box2>
    ))
    .add('Normal', () => <Tracker username="darksim905" />)
    .add('Long reason', () => (
      <Tracker
        username="darksim905"
        {...Sb.propOverridesForStory({
          reason:
            'This is a very very very very very very very very very very very very very very very very very very very very very very very very very very very very long reason',
        })}
      />
    ))
    .add('Long bio', () => <Tracker username="longbio" />)
    .add('Long location', () => <Tracker username="longlocation" />)
    .add('Long username', () => <Tracker username="a23456789012345" />)
    .add('Long fullanme', () => <Tracker username="longfullname" />)
}

const wrapper = {
  height: 470,
  width: 320,
}

export default load
