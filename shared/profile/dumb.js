// @noflow
import ProveEnterUsername from './prove-enter-username'
import ProveWebsiteChoice from './prove-website-choice'
import Revoke from './revoke'
import pgpDumb from './pgp/dumb'
import {isMobile} from '../styles'
import type {DumbComponentMap} from '../constants/types/more'

const proveEnterUsernameBase = {
  username: 'chris',
  errorText: null,
  errorCode: null,
  canContinue: true,
  onUsernameChange: username => {
    console.log('username change', username)
  },
  onContinue: () => {
    console.log('continue clicked')
  },
  onCancel: () => {
    console.log('cancel clicked')
  },
  parentProps: isMobile ? {} : {style: {display: 'flex', minWidth: 640, height: 580}},
}

const dumbProveEnterUsername: DumbComponentMap<ProveEnterUsername> = {
  component: ProveEnterUsername,
  mocks: {
    Twitter: {...proveEnterUsernameBase, platform: 'twitter'},
    'Twitter with Error': {...proveEnterUsernameBase, platform: 'twitter', errorText: 'Something went wrong'},
    Reddit: {...proveEnterUsernameBase, platform: 'reddit'},
    Facebook: {...proveEnterUsernameBase, platform: 'facebook'},
    GitHub: {...proveEnterUsernameBase, platform: 'github'},
    'Hacker News': {...proveEnterUsernameBase, platform: 'hackernews'},
    Bitcoin: {...proveEnterUsernameBase, platform: 'btc'},
    'Bitcoin - Disabled': {...proveEnterUsernameBase, platform: 'btc', canContinue: false},
    DNS: {...proveEnterUsernameBase, platform: 'dns'},
    Website: {...proveEnterUsernameBase, platform: 'http'},
    Zcash: {...proveEnterUsernameBase, platform: 'zcash'},
  },
}

const revokeBase = {
  onCancel: () => console.log('Revoke Proof: clicked Cancel'),
  onRevoke: () => console.log('Revoke Proof: clicked Revoke'),
}

const revokeTwitter = {
  ...revokeBase,
  platformHandle: 'alexrwendland',
  platform: 'twitter',
}

const dumbRevoke: DumbComponentMap<Revoke> = {
  component: Revoke,
  mocks: {
    Twitter: {...revokeTwitter},
    'Twitter - Error': {
      ...revokeTwitter,
      errorMessage: 'There was an error revoking your proof. You can click the button to try again.',
    },
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

const dumbProveWebsiteChoice: DumbComponentMap<ProveWebsiteChoice> = {
  component: ProveWebsiteChoice,
  mocks: {
    'DNS or File': {
      onCancel: () => console.log('ProveWebsiteChoice: onCancel'),
      onOptionClick: op => console.log(`ProveWebsiteChoice: onOptionClick = ${op}`),
    },
  },
}

export default {
  'Revoke Proof': dumbRevoke,
  'New Proof: Enter Username': dumbProveEnterUsername,
  'New Proof: Website': dumbProveWebsiteChoice,
  ...pgpDumb,
}
