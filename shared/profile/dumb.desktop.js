/* @flow */
import Profile from './render'
import {normal} from '../constants/tracker'
import {metaNone} from '../constants/tracker'
import type {Props as RenderProps} from './render'
import type {Proof} from '../common-adapters/user-proofs'
import type {UserInfo} from '../common-adapters/user-bio'
import type {DumbComponentMap} from '../constants/types/more'

const proofTwitter: Proof = {name: 'twitteruser', type: 'twitter', id: 'twitterId', state: normal, meta: metaNone, humanUrl: 'twitter.com', profileUrl: 'http://twitter.com', isTracked: false}
const proofWeb: Proof = {name: 'thelongestdomainnameintheworldandthensomeandthensomemoreandmore.com', type: 'http', id: 'webId', state: normal, meta: metaNone, humanUrl: 'thelongestdomainnameintheworldandthensomeandthensomemoreandmore.com', profileUrl: '', isTracked: false}
const proofHN: Proof = {name: 'pg', type: 'hackernews', id: 'hnId', state: normal, meta: metaNone, humanUrl: 'news.ycombinator.com', profileUrl: 'http://news.ycombinator.com', isTracked: false}
const proofRooter: Proof = {name: 'roooooooter', type: 'rooter', state: normal, meta: metaNone, id: 'rooterId', humanUrl: '', profileUrl: '', isTracked: false}

const proofsDefault: Array<Proof> = [
  proofTwitter,
  proofWeb,
  proofHN,
  proofRooter
]

const userBase: {username: string, userInfo: UserInfo} = {
  username: 'darksim905',
  userInfo: {
    fullname: 'Gabriel Handford',
    followersCount: 1871,
    followingCount: 356,
    location: 'San Francisco, California, USA, Earth, Milky Way',
    bio: 'Etsy photo booth mlkshk semiotics, 8-bit literally slow-carb keytar bushwick +1. Plaid migas etsy yuccie, locavore street art mlkshk lumbersexual. Literally microdosing pug disrupt iPhone raw denim, quinoa meggings kitsch.',
    avatar: 'https://keybase.io/darksim905/picture',
    followsYou: false
  }
}

const propsBase: RenderProps = {
  ...userBase,
  proofs: proofsDefault,
  currentlyFollowing: false,
  trackerState: normal,
  onFollow: () => {},
  onUnfollow: () => {}
}

const dumbMap: DumbComponentMap<Profile> = {
  component: Profile,
  mocks: {
    'Unfollowed': propsBase,
    'Followed': {...propsBase, currentlyFollowing: true}
  }
}

export default {
  'Profile': dumbMap
}
