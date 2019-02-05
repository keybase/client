// @flow
import * as React from 'react'
import * as Sb from '../stories/storybook'
import * as Kb from '../common-adapters'
import Tracker from './index.desktop'

const assertion = {
  assertion: '',
  color: 'blue',
  metas: [],
  proofURL: '',
  siteIcon: '',
  siteURL: '',
  state: 'valid',
}

const github = {...assertion, assertion: 'githubuser:github', siteIcon: 'iconfont-identity-github'}
const twitter = {
  ...assertion,
  assertion: 'twitteruser:twitter',
  color: 'gray',
  siteIcon: 'iconfont-identity-twitter',
  state: 'checking',
}
const facebook = {
  ...assertion,
  assertion: 'facebookuser:facebook',
  color: 'red',
  siteIcon: 'iconfont-identity-facebook',
  state: 'error',
}
const hackernews = {
  ...assertion,
  assertion: 'hackernewsuser:hackernews',
  color: 'yellow',
  siteIcon: 'iconfont-identity-hn',
  state: 'warning',
}
const reddit = {
  ...assertion,
  assertion: 'reddituser:reddit',
  color: 'red',
  siteIcon: 'iconfont-identity-reddit',
  state: 'revoked',
}
const pgp = {...assertion, assertion: 'DEADBEEFFEEBDAED:pgp', siteIcon: 'iconfont-identity-pgp'}
const https = {...assertion, assertion: 'httpsuser:https', siteIcon: 'iconfont-identity-website'}
const rooter = {...assertion, assertion: 'rooteruser:rooter', siteIcon: 'iconfont-thunderbolt'}
const dns = {...assertion, assertion: 'dnsuser:dns', siteIcon: 'iconfont-identity-website'}

const shorter = a => ({
  ...a,
  assertion: a.assertion
    .split('.')
    .map((s, idx) => (idx ? s : s.substr(0, s.length - 2)))
    .join('.'),
})
const web1 = {
  ...assertion,
  assertion: 'thelongestdomainnameintheworldandthensomeandthensomemoreandmore.com:https',
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
const trackerOnlyProps = {
  bio:
    'Etsy photo booth mlkshk semiotics, 8-bit literally slow-carb keytar bushwick +1. Plaid migas etsy yuccie, locavore street art mlkshk lumbersexual. Literally microdosing pug disrupt iPhone raw denim, quinoa meggings kitsch.',
  followThem: false,
  followersCount: 1871,
  followingCount: 356,
  followsYou: false,
  guiID: '',
  location: 'San Francisco, California, USA, Earth, Milky Way',
  onAccept: Sb.action('onAccept'),
  onChat: Sb.action('onChat'),
  onClose: Sb.action('onClose'),
  onFollow: Sb.action('onFollow'),
  onIgnoreFor24Hours: Sb.action('onIgnoreFor24Hours'),
  onReload: Sb.action('onReload'),
  reason: 'You accessed a private folder with gabrielh.',
  state: 'valid',
  teamShowcase: [],
  username: 'darksim905',
}
const props = {
  ...trackerOnlyProps,
  assertions: allAssertions.map(a => a.assertion),
  fullname: 'Gabriel Handford',
}

const teams = [
  {
    description: 'team A',
    isOpen: false,
    membersCount: 123,
    name: 'teamA',
    publicAdmins: ['max', 'chris'],
  },
  {
    description: 'team open',
    isOpen: true,
    membersCount: 3,
    name: 'teamOpen',
    publicAdmins: ['chris'],
  },
]

const provider = Sb.createPropProviderWithCommon({
  Assertion: p => {
    const a = allAssertions.find(a => a.assertion === p.assertionKey)
    if (!a) {
      throw new Error('cant happen')
    }
    const parts = a.assertion.split(':')
    const site = parts[1]
    return {
      color: a.color,
      metas: a.metas,
      onClickBadge: Sb.action('onClickBadge'),
      onShowProof: Sb.action('onShowProof'),
      onShowSite: Sb.action('onShowSite'),
      onShowUserOnSite: Sb.action('onShowUserOnSite'),
      proofURL: a.proofURL,
      siteIcon: a.siteIcon,
      siteURL: a.siteURL,
      state: a.state,
      type: site,
      value: parts[0],
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
    followersCount: p.username === 'nofollowcounts' ? null : props.followersCount,
    followingCount: p.username === 'nofollowcounts' ? null : props.followingCount,
    fullname:
      p.username === 'longfullname'
        ? 'mr longlonlonglonlonglonlonglonlonglonggggglonglonglongnarm squire the third'
        : p.username === 'nofullname'
        ? null
        : props.fullname,
    location:
      p.username === 'longlocation'
        ? 'This is a very very very very very very very very very very very very very very very very very very very very very very very very very very very very long location'
        : props.location,
  }),
})

const trackerProps = username => ({
  ...trackerOnlyProps,
  assertionKeys:
    username === 'noProofs' ? [] : username === 'oneProof' ? [props.assertions[0]] : [...props.assertions],
  followThem: username === 'green' ? true : props.followThem,
  isYou: username === 'yourUsername',
  reason:
    username === 'longreason'
      ? 'This is a very very very very very very very very very very very very very very very very very very very very very very very very very very very very long reason'
      : props.reason,
  state: username === 'red' ? 'error' : username === 'green' ? 'valid' : props.state,
  teamShowcase: username === 'teams' ? teams : props.teamShowcase,
  username,
})

const load = () => {
  Sb.storiesOf('Tracker2', module)
    .addDecorator(provider)
    .addDecorator(story => (
      <Kb.Box2 direction="vertical" style={wrapper}>
        {story()}
      </Kb.Box2>
    ))
    .add('Normal', () => <Tracker {...trackerProps('darksim905')} />)
    .add('Long reason', () => <Tracker {...trackerProps('longreason')} />)
    .add('Long bio', () => <Tracker {...trackerProps('longbio')} />)
    .add('Long location', () => <Tracker {...trackerProps('longlocation')} />)
    .add('Long username', () => <Tracker {...trackerProps('a23456789012345')} />)
    .add('Long fullanme', () => <Tracker {...trackerProps('longfullname')} />)
    .add('No fullanme', () => <Tracker {...trackerProps('nofullname')} />)
    .add('No followcounts', () => <Tracker {...trackerProps('nofollowcounts')} />)
    .add('OneProof', () => <Tracker {...trackerProps('oneProof')} />)
    .add('NoProofs', () => <Tracker {...trackerProps('noProofs')} />)
    .add('Green', () => <Tracker {...trackerProps('green')} />)
    .add('Red', () => <Tracker {...trackerProps('red')} />)
    .add('Teams', () => <Tracker {...trackerProps('teams')} />)
    .add('Your username', () => <Tracker {...trackerProps('yourUsername')} />)
}

const wrapper = {
  height: 470,
  width: 320,
}

export default load
