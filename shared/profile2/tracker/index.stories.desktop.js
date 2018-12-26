// @flow
import * as React from 'react'
import * as Sb from '../../stories/storybook'
import Tracker from './index.desktop'

const assertion = {
  assertion: '',
  metas: [],
  proofURL: '',
  siteIcon: '',
  siteURL: '',
  state: 'valid',
}

const github = {...assertion, assertion: 'githubuser@github', siteIcon: 'iconfont-identity-github'}
const twitter = {...assertion, assertion: 'twitteruser@twitter', siteIcon: 'iconfont-identity-twitter'}
const facebook = {...assertion, assertion: 'facebookuser@facebook', siteIcon: 'iconfont-identity-facebook'}
const hackernews = {...assertion, assertion: 'hackernewsuser@hackernews', siteIcon: 'iconfont-identity-hn'}
const reddit = {...assertion, assertion: 'reddituser@reddit', siteIcon: 'iconfont-identity-reddit'}
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
  assertion: 'thelongestdomainnameintheworldandthensomeandthensomemoreandmore.com',
  siteIcon: 'iconfont-identity-website',
}
const web2 = shorter(web1)
const web3 = shorter(web2)
const web4 = shorter(web3)
const web5 = shorter(web4)

const props = {
  assertions: [
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
  ],
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
  username: 'darksim905',
}

const provider = Sb.createPropProviderWithCommon({
  Tracker2: p => ({}),
})

const load = () => {
  Sb.storiesOf('Tracker2', module)
    .addDecorator(provider)
    .add('New User', () => <Tracker {...props} />)
}

export default load
