import * as dateFns from 'date-fns'
import * as React from 'react'
import * as Container from '../util/container'
import * as Sb from '../stories/storybook'
import proofsList from './generic/proofs-list/index.stories'
import {BioTeamProofs, BackgroundColorType} from './user'
import WebOfTrust from './user/weboftrust/index'
import {WotStatusType} from '../constants/types/rpc-gen'

const providerUser = (cfProps =>
  Sb.createPropProviderWithCommon({
    Actions: () => ({
      _guiID: 'd.guiID',
      _you: 'Chris',
      followThem: false,
      followsYou: false,
      loadFeaturedBots: () => Sb.action('loadFeaturedBots'),
      onAccept: () => Sb.action('onAccept'),
      onAddToTeam: () => Sb.action('onAddToTeam'),
      onBrowsePublicFolder: () => Sb.action('onBrowsePublicFolder'),
      onChat: () => Sb.action('onEditAvatarClick'),
      onEditProfile: Sb.action('onEditAvatarClick'),
      onFollow: () => Sb.action('onEditAvatarClick'),
      onIgnoreFor24Hours: Sb.action('onEditAvatarClick'),
      onInstallBot: Sb.action('onInstallBot'),
      onOpenPrivateFolder: Sb.action('onEditAvatarClick'),
      onReload: () => Sb.action('onEditAvatarClick'),
      onRequestLumens: () => Sb.action('onEditAvatarClick'),
      onSendLumens: () => Sb.action('onEditAvatarClick'),
      onUnfollow: () => Sb.action('onEditAvatarClick'),
      state: 'valid',
    }),
    Bio: () => ({
      bio: 'biographical information',
      followThem: false,
      followersCount: 0,
      followingCount: 0,
      followsYou: false,
      fullname: 'Chris Coyne',
      inTracker: false,
      location: 'NYC',
    }),
    ConnectedFolders: () => ({
      loadTlfs: Sb.action('loadTlfs'),
      tlfs: [
        {...cfProps, isPublic: true, isSelf: true, text: `public/meatball`},
        {...cfProps, isPublic: true, isSelf: false, text: `public/meatball,songgao`},
        {...cfProps, isPublic: false, isSelf: true, text: `private/meatball`},
        {...cfProps, isPublic: false, isSelf: false, text: `private/meatball,songgao`},
      ],
    }),
    Teams: () => ({
      onEdit: Sb.action('onEditAvatarClick'),
      onJoinTeam: Sb.action('onEditAvatarClick'),
      teamMeta: ([] as Array<any>).reduce((map, t) => {
        map[t.name] = {
          inTeam: false,
        }
        return map
      }, {}),
      teamShowcase: [],
    }),
  }))({
  openInFilesTab: Sb.action('openInFilesTab'),
  style: {maxWidth: 256},
})

const bioPropsUser = {
  assertionKeys: [],
  backgroundColorType: 'green' as BackgroundColorType,
  name: 'chris',
  notAUser: false,
  onAddIdentity: Sb.action('onAddIdentity'),
  reason: 'storybook',
  service: '',
  suggestionKeys: [],
  title: 'chris',
  username: 'Chris',
}

const notAUserAssertion = {
  color: 'gray',
  metas: [
    {
      color: 'gray',
      label: 'PENDING',
    },
  ],
  proofURL: '',
  sigID: '0',
  siteURL: '',
  state: 'checking',
  timestamp: 0,
}

const providerSBS = Sb.createPropProviderWithCommon({
  Actions: () => ({
    _guiID: 'd.guiID',
    _you: 'test',
    followThem: false,
    followsYou: false,
    loadFeaturedBots: () => Sb.action('loadFeaturedBots'),
    onAccept: () => Sb.action('onAccept'),
    onAddToTeam: () => Sb.action('onAddToTeam'),
    onBrowsePublicFolder: () => Sb.action('onBrowsePublicFolder'),
    onChat: () => Sb.action('onEditAvatarClick'),
    onFollow: () => Sb.action('onEditAvatarClick'),
    onIgnoreFor24Hours: Sb.action('onEditAvatarClick'),
    onInstallBot: Sb.action('onInstallBot'),
    onOpenPrivateFolder: Sb.action('onEditAvatarClick'),
    onReload: () => Sb.action('onEditAvatarClick'),
    onRequestLumens: () => Sb.action('onEditAvatarClick'),
    onSendLumens: () => Sb.action('onEditAvatarClick'),
    onUnfollow: () => Sb.action('onEditAvatarClick'),
    state: 'notAUserYet',
  }),
  Assertion: () => ({
    ...notAUserAssertion,
    type: 'twitter',
    value: 'chris',
  }),
  Bio: () => ({
    bio: 'biographical information',
    followThem: false,
    followersCount: null,
    followingCount: null,
    followsYou: false,
    fullname: 'Twitter Chris',
    inTracker: false,
    sbsDescription: 'Twitter user',
  }),
  ConnectedFolders: () => ({
    loadTlfs: Sb.action('loadTlfs'),
    tlfs: [],
  }),
  Teams: () => ({
    onJoinTeam: Sb.action('onEditAvatarClick'),
    teamMeta: {},
    teamShowcase: [],
  }),
})

const bioPropsSBS = {
  assertionKeys: ['chris@twitter'],
  backgroundColorType: 'blue' as BackgroundColorType,
  fullName: 'Twitter Chris',
  name: 'chris',
  notAUser: true,
  reason: 'storybook',
  sbsAvatarUrl: 'https://pbs.twimg.com/profile_images/916052872952995840/Z3AvozIu_400x400.jpg',
  service: 'twitter',
  serviceIcon: [
    {path: 'https://keybase.io/images/paramproofs/services/twitter/logo_full_64.png', width: 64},
    {path: 'https://keybase.io/images/paramproofs/services/twitter/logo_full_64@2x.png', width: 128},
  ],
  title: 'chris',
  username: 'chris@twitter',
}

// logged in as `max`
const common = Sb.createStoreWithCommon()
const wotStore = Container.produce(common, draftState => {
  draftState.config.username = 'max'
})

const fourHoursAgo = dateFns.sub(new Date(), {hours: 4}).getTime()
const baseAttestation = {
  attestation:
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
  proofID: 'whateverwhatever',
  verificationType: 'video' as 'video',
  vouchedAt: fourHoursAgo,
}

// max attests for alice (pending)
const wotSeePendingAsVoucher = {
  username: 'alice',
  webOfTrustAttestation: {
    ...baseAttestation,
    attestingUser: 'max',
    status: WotStatusType.proposed,
  },
}

// max attests for alice (accepted)
const wotSeeAcceptedAsVoucher = {
  username: 'alice',
  webOfTrustAttestation: {
    ...baseAttestation,
    attestingUser: 'max',
    status: WotStatusType.accepted,
  },
}

// max attests for alice (rejected)
const wotSeeRejectedAsVoucher = {
  username: 'alice',
  webOfTrustAttestation: {
    ...baseAttestation,
    attestingUser: 'max',
    status: WotStatusType.rejected,
  },
}

// max looking at chris' accepted vouch for alice
const wotSeeAccepted = {
  username: 'alice',
  webOfTrustAttestation: {
    ...baseAttestation,
    attestingUser: 'chris',
    status: WotStatusType.accepted,
  },
}

// max sees an attestation of his own from alice (pending)
const wotSeePendingAsVouchee = {
  username: 'max',
  webOfTrustAttestation: {
    ...baseAttestation,
    attestingUser: 'alice',
    status: WotStatusType.proposed,
  },
}

// max sees an attestation of his own from alice (accepted)
const wotSeeAcceptedAsVouchee = {
  username: 'max',
  webOfTrustAttestation: {
    ...baseAttestation,
    attestingUser: 'alice',
    status: WotStatusType.accepted,
  },
}

// max sees an attestation of his own from alice (rejected)
const wotSeeRejectedAsVouchee = {
  username: 'max',
  webOfTrustAttestation: {
    ...baseAttestation,
    attestingUser: 'alice',
    status: WotStatusType.rejected,
  },
}

const load = () => {
  proofsList()

  Sb.storiesOf('Profile/Profile', module)
    .addDecorator(providerUser)
    .add('BioTeamProofs', () => <BioTeamProofs {...bioPropsUser} />)
    .addDecorator((story: any) => <Sb.MockStore store={wotStore}>{story()}</Sb.MockStore>)
    .add('Web of Trust - pending as voucher', () => <WebOfTrust {...wotSeePendingAsVoucher} />)
    .add('Web of Trust - accepted as voucher', () => <WebOfTrust {...wotSeeAcceptedAsVoucher} />)
    .add('Web of Trust - rejected as voucher', () => <WebOfTrust {...wotSeeRejectedAsVoucher} />)
    .add('Web of Trust - uninvolved accepted', () => <WebOfTrust {...wotSeeAccepted} />)
    .add('Web of Trust - pending as vouchee', () => <WebOfTrust {...wotSeePendingAsVouchee} />)
    .add('Web of Trust - accepted as vouchee', () => <WebOfTrust {...wotSeeAcceptedAsVouchee} />)
    .add('Web of Trust - rejected as vouchee', () => <WebOfTrust {...wotSeeRejectedAsVouchee} />)

  Sb.storiesOf('Profile/Profile', module)
    .addDecorator(providerSBS)
    .add('SBS Profile', () => <BioTeamProofs {...bioPropsSBS} />)
}
export default load
