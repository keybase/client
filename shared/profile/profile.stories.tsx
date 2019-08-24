import * as React from 'react'
import * as Sb from '../stories/storybook'
import proofsList from './generic/proofs-list/index.stories'
import {BioTeamProofs, BackgroundColorType} from './user'

const providerUser = (cfProps =>
  Sb.createPropProviderWithCommon({
    Actions: () => ({
      _guiID: 'd.guiID',
      _you: 'Chris',
      followThem: false,
      followsYou: false,
      onAccept: () => Sb.action('onAccept'),
      onAddToTeam: () => Sb.action('onAddToTeam'),
      onBrowsePublicFolder: () => Sb.action('onBrowsePublicFolder'),
      onChat: () => Sb.action('onEditAvatarClick'),
      onEditProfile: Sb.action('onEditAvatarClick'),
      onFollow: () => Sb.action('onEditAvatarClick'),
      onIgnoreFor24Hours: Sb.action('onEditAvatarClick'),
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
      registeredForAirdrop: false,
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
  fullName: null,
  name: 'chris',
  notAUser: false,
  onAddIdentity: Sb.action('onAddIdentity'),
  onEditAvatar: null,
  reason: 'storybook',
  service: '',
  serviceIcon: null,
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
  siteIcon: null,
  siteIconFull: null,
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
    onAccept: () => Sb.action('onAccept'),
    onAddToTeam: () => Sb.action('onAddToTeam'),
    onBrowsePublicFolder: () => Sb.action('onBrowsePublicFolder'),
    onChat: () => Sb.action('onEditAvatarClick'),
    onFollow: () => Sb.action('onEditAvatarClick'),
    onIgnoreFor24Hours: Sb.action('onEditAvatarClick'),
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
    registeredForAirdrop: false,
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
  onAddIdentity: null,
  onEditAvatar: null,
  reason: 'storybook',
  sbsAvatarUrl: 'https://pbs.twimg.com/profile_images/916052872952995840/Z3AvozIu_400x400.jpg',
  service: 'twitter',
  serviceIcon: [
    {path: 'https://keybase.io/images/paramproofs/services/twitter/logo_full_64.png', width: 64},
    {path: 'https://keybase.io/images/paramproofs/services/twitter/logo_full_64@2x.png', width: 128},
  ],
  suggestionKeys: null,
  title: 'chris',
  username: 'chris@twitter',
}

const load = () => {
  proofsList()

  Sb.storiesOf('Profile/Profile', module)
    .addDecorator(providerUser)
    .add('BioTeamProofs', () => <BioTeamProofs {...bioPropsUser} />)

  Sb.storiesOf('Profile/Profile', module)
    .addDecorator(providerSBS)
    .add('SBS Profile', () => <BioTeamProofs {...bioPropsSBS} />)
}
export default load
