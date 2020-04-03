import * as React from 'react'
import * as Sb from '../../stories/storybook'
import {Question1, Question2, Proof} from '.'
import sortBy from 'lodash/sortBy'

// snapshot of tracker2 assertions: DEBUGStore.getState().tracker2.usernameToDetails.get("mlsteele").assertions
/* eslint-disable sort-keys */
const sampleAssertions = {
  'mastodon.social:mlsteele': {
    assertionKey: 'mastodon.social:mlsteele',
    belowFold: false,
    color: 'blue',
    kid: ',',
    metas: [],
    pickerSubtext: '',
    pickerText: '',
    priority: 700,
    proofURL:
      'https://keybase.io/mlsteele/sigchain#a361a85fffc05023f720097de8353351b8eaf7b5312d58a9762be07d42a9e3a20f',
    sigID: 'a361a85fffc05023f720097de8353351b8eaf7b5312d58a9762be07d42a9e3a20f',
    siteIcon: [
      {
        path: 'https://keybase.io/images/paramproofs/services/mastodon.social/logo_black_16.png?c=3',
        width: 16,
      },
      {
        path: 'https://keybase.io/images/paramproofs/services/mastodon.social/logo_black_16@2x.png?c=3',
        width: 32,
      },
    ],
    siteIconDarkmode: [
      {
        path: 'https://keybase.io/images/paramproofs/services/mastodon.social/logo_white_16.png?c=3',
        width: 16,
      },
      {
        path: 'https://keybase.io/images/paramproofs/services/mastodon.social/logo_white_16@2x.png?c=3',
        width: 32,
      },
    ],
    siteIconFull: [
      {
        path: 'https://keybase.io/images/paramproofs/services/mastodon.social/logo_full_64.png?c=3',
        width: 64,
      },
      {
        path: 'https://keybase.io/images/paramproofs/services/mastodon.social/logo_full_64@2x.png?c=3',
        width: 128,
      },
    ],
    siteIconFullDarkmode: [
      {
        path: 'https://keybase.io/images/paramproofs/services/mastodon.social/logo_full_darkmode_64.png?c=3',
        width: 64,
      },
      {
        path:
          'https://keybase.io/images/paramproofs/services/mastodon.social/logo_full_darkmode_64@2x.png?c=3',
        width: 128,
      },
    ],
    siteURL: 'https://mastodon.social/@mlsteele',
    state: 'valid',
    timestamp: 1554393831000,
    type: 'mastodon.social',
    value: 'mlsteele',
  },
  'https:milessteele.com': {
    assertionKey: 'https:milessteele.com',
    belowFold: false,
    color: 'blue',
    kid: ',',
    metas: [],
    pickerSubtext: '',
    pickerText: '',
    priority: 100,
    proofURL: 'https://milessteele.com/keybase.txt',
    sigID: 'e97e7e7637705f75c7a6edecbf4ea4340fd9b588b300dba552ea8048df4d978a0f',
    siteIcon: [
      {path: 'https://keybase.io/images/paramproofs/services/web/logo_black_16.png?c=3', width: 16},
      {path: 'https://keybase.io/images/paramproofs/services/web/logo_black_16@2x.png?c=3', width: 32},
    ],
    siteIconDarkmode: [
      {path: 'https://keybase.io/images/paramproofs/services/web/logo_white_16.png?c=3', width: 16},
      {path: 'https://keybase.io/images/paramproofs/services/web/logo_white_16@2x.png?c=3', width: 32},
    ],
    siteIconFull: [
      {path: 'https://keybase.io/images/paramproofs/services/web/logo_full_64.png?c=3', width: 64},
      {path: 'https://keybase.io/images/paramproofs/services/web/logo_full_64@2x.png?c=3', width: 128},
    ],
    siteIconFullDarkmode: [
      {path: 'https://keybase.io/images/paramproofs/services/web/logo_full_darkmode_64.png?c=3', width: 64},
      {
        path: 'https://keybase.io/images/paramproofs/services/web/logo_full_darkmode_64@2x.png?c=3',
        width: 128,
      },
    ],
    siteURL: 'https://milessteele.com',
    state: 'valid',
    timestamp: 1437509684000,
    type: 'https',
    value: 'milessteele.com',
  },
  'github:mlsteele': {
    assertionKey: 'github:mlsteele',
    belowFold: false,
    color: 'blue',
    kid: ',',
    metas: [],
    pickerSubtext: '',
    pickerText: '',
    priority: 2,
    proofURL: 'https://gist.github.com/08562c50dde01e5b6d6e',
    sigID: 'cff5e2b5a713cd70acc803a55749fc3b5c57a78f4a0c29cc806405e539d0acc00f',
    siteIcon: [
      {path: 'https://keybase.io/images/paramproofs/services/github/logo_black_16.png?c=3', width: 16},
      {path: 'https://keybase.io/images/paramproofs/services/github/logo_black_16@2x.png?c=3', width: 32},
    ],
    siteIconDarkmode: [
      {path: 'https://keybase.io/images/paramproofs/services/github/logo_white_16.png?c=3', width: 16},
      {path: 'https://keybase.io/images/paramproofs/services/github/logo_white_16@2x.png?c=3', width: 32},
    ],
    siteIconFull: [
      {path: 'https://keybase.io/images/paramproofs/services/github/logo_full_64.png?c=3', width: 64},
      {path: 'https://keybase.io/images/paramproofs/services/github/logo_full_64@2x.png?c=3', width: 128},
    ],
    siteIconFullDarkmode: [
      {
        path: 'https://keybase.io/images/paramproofs/services/github/logo_full_darkmode_64.png?c=3',
        width: 64,
      },
      {
        path: 'https://keybase.io/images/paramproofs/services/github/logo_full_darkmode_64@2x.png?c=3',
        width: 128,
      },
    ],
    siteURL: 'https://github.com/mlsteele',
    state: 'valid',
    timestamp: 1437509440000,
    type: 'github',
    value: 'mlsteele',
  },
  'twitter:mlsteele': {
    assertionKey: 'twitter:mlsteele',
    belowFold: false,
    color: 'blue',
    kid: ',',
    metas: [],
    pickerSubtext: '',
    pickerText: '',
    priority: 1,
    proofURL: 'https://twitter.com/mlsteele/status/623591773345083393',
    sigID: 'baeaf98fe0bd77abd7014da0d83fa5857318bec8c1bf0700e0f47a53b45e4f9a0f',
    siteIcon: [
      {path: 'https://keybase.io/images/paramproofs/services/twitter/logo_black_16.png?c=3', width: 16},
      {path: 'https://keybase.io/images/paramproofs/services/twitter/logo_black_16@2x.png?c=3', width: 32},
    ],
    siteIconDarkmode: [
      {path: 'https://keybase.io/images/paramproofs/services/twitter/logo_white_16.png?c=3', width: 16},
      {path: 'https://keybase.io/images/paramproofs/services/twitter/logo_white_16@2x.png?c=3', width: 32},
    ],
    siteIconFull: [
      {path: 'https://keybase.io/images/paramproofs/services/twitter/logo_full_64.png?c=3', width: 64},
      {path: 'https://keybase.io/images/paramproofs/services/twitter/logo_full_64@2x.png?c=3', width: 128},
    ],
    siteIconFullDarkmode: [
      {
        path: 'https://keybase.io/images/paramproofs/services/twitter/logo_full_darkmode_64.png?c=3',
        width: 64,
      },
      {
        path: 'https://keybase.io/images/paramproofs/services/twitter/logo_full_darkmode_64@2x.png?c=3',
        width: 128,
      },
    ],
    siteURL: 'https://twitter.com/mlsteele',
    state: 'valid',
    timestamp: 1437510817000,
    type: 'twitter',
    value: 'mlsteele',
  },
  'btc:1BtCWKzmZTmRdH63CZzJeVD1MUMSshniFo': {
    assertionKey: 'btc:1BtCWKzmZTmRdH63CZzJeVD1MUMSshniFo',
    belowFold: false,
    color: 'blue',
    kid: ',',
    metas: [],
    pickerSubtext: '',
    pickerText: '',
    priority: 104,
    proofURL:
      'https://keybase.io/mlsteele/sigchain#c5475d3d54189232ff2d6c745de0684ed6102c7b2031fd2b4b6518f509f1676d0f',
    sigID: 'c5475d3d54189232ff2d6c745de0684ed6102c7b2031fd2b4b6518f509f1676d0f',
    siteIcon: [
      {path: 'https://keybase.io/images/paramproofs/services/btc/logo_black_16.png?c=3', width: 16},
      {path: 'https://keybase.io/images/paramproofs/services/btc/logo_black_16@2x.png?c=3', width: 32},
    ],
    siteIconDarkmode: [
      {path: 'https://keybase.io/images/paramproofs/services/btc/logo_white_16.png?c=3', width: 16},
      {path: 'https://keybase.io/images/paramproofs/services/btc/logo_white_16@2x.png?c=3', width: 32},
    ],
    siteIconFull: [
      {path: 'https://keybase.io/images/paramproofs/services/btc/logo_full_64.png?c=3', width: 64},
      {path: 'https://keybase.io/images/paramproofs/services/btc/logo_full_64@2x.png?c=3', width: 128},
    ],
    siteIconFullDarkmode: [
      {path: 'https://keybase.io/images/paramproofs/services/btc/logo_full_darkmode_64.png?c=3', width: 64},
      {
        path: 'https://keybase.io/images/paramproofs/services/btc/logo_full_darkmode_64@2x.png?c=3',
        width: 128,
      },
    ],
    siteURL:
      'https://keybase.io/mlsteele/sigchain#c5475d3d54189232ff2d6c745de0684ed6102c7b2031fd2b4b6518f509f1676d0f',
    state: 'valid',
    timestamp: 0,
    type: 'btc',
    value: '1BtCWKzmZTmRdH63CZzJeVD1MUMSshniFo',
  },
  'stellar:mlsteele*keybase.io': {
    assertionKey: 'stellar:mlsteele*keybase.io',
    belowFold: false,
    color: 'blue',
    kid: ',',
    metas: [],
    pickerSubtext: '',
    pickerText: '',
    priority: 108,
    proofURL:
      'https://keybase.io/mlsteele/sigchain#5682d7b1cdc5922346106a7520f87cd0e3128390ce23bedd1fd6e1d75d7ebdf622',
    sigID: '5682d7b1cdc5922346106a7520f87cd0e3128390ce23bedd1fd6e1d75d7ebdf622',
    siteIcon: [
      {path: 'https://keybase.io/images/paramproofs/services/stellar/logo_black_16.png?c=3', width: 16},
      {path: 'https://keybase.io/images/paramproofs/services/stellar/logo_black_16@2x.png?c=3', width: 32},
    ],
    siteIconDarkmode: [
      {path: 'https://keybase.io/images/paramproofs/services/stellar/logo_white_16.png?c=3', width: 16},
      {path: 'https://keybase.io/images/paramproofs/services/stellar/logo_white_16@2x.png?c=3', width: 32},
    ],
    siteIconFull: [
      {path: 'https://keybase.io/images/paramproofs/services/stellar/logo_full_64.png?c=3', width: 64},
      {path: 'https://keybase.io/images/paramproofs/services/stellar/logo_full_64@2x.png?c=3', width: 128},
    ],
    siteIconFullDarkmode: [
      {
        path: 'https://keybase.io/images/paramproofs/services/stellar/logo_full_darkmode_64.png?c=3',
        width: 64,
      },
      {
        path: 'https://keybase.io/images/paramproofs/services/stellar/logo_full_darkmode_64@2x.png?c=3',
        width: 128,
      },
    ],
    siteURL:
      'https://keybase.io/mlsteele/sigchain#5682d7b1cdc5922346106a7520f87cd0e3128390ce23bedd1fd6e1d75d7ebdf622',
    state: 'valid',
    timestamp: 0,
    type: 'stellar',
    value: 'mlsteele*keybase.io',
  },
}
/* eslint-enable sort-keys */

const sampleProofs: Proof[] = sortBy(Object.values(sampleAssertions), x => x.priority).filter(
  x => x.type !== 'stellar'
)

const storyProofs: Proof[] = [
  {type: 'service03', value: 'shockinglylongusernamewithagreatmanyletters'},
  {type: 'shockinglylongtypewithagreatmanyletters', value: 'user02'},
].map(x => ({
  siteIcon: sampleProofs[0].siteIcon,
  siteIconDarkmode: sampleProofs[0].siteIcon,
  ...x,
}))

const props = {
  initialVerificationType: 'in_person' as 'in_person',
  onBack: Sb.action('onBack'),
  onSubmit: Sb.action('onSubmit'),
  proofs: [...sampleProofs, ...storyProofs],
  voucheeUsername: 'weijiekohyalenus',
}

const errorProps = {
  error: 'You are offline.',
}

const load = () => {
  Sb.storiesOf('Profile/WotAuthor', module)
    .addDecorator(Sb.createPropProviderWithCommon())
    .add('Question1', () => <Question1 {...props} />)
    .add('Question2', () => <Question2 {...props} />)
    .add('Question1 error', () => <Question1 {...props} {...errorProps} />)
    .add('Question2 error', () => <Question2 {...props} {...errorProps} />)
    .add('Question2 spinning', () => <Question2 {...props} waiting={true} />)
}

export default load
