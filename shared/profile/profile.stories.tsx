import * as React from 'react'
import * as Sb from '../stories/storybook'
import * as TrackerConstants from '../constants/tracker2'
import proofsList from './generic/proofs-list/index.stories'
import {BioTeamProofs, BackgroundColorType} from './user'

const provider = (cfProps =>
  Sb.createPropProviderWithCommon({
    Actions: props => ({
      followThem: false,
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
      state: {
        _guiID: 'd.guiID',
        _you: 'Chris',
        followThem: false,
        state: TrackerConstants.noDetails,
        username: 'Chris',
      },
    }),
    Bio: props => ({
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
    Teams: props => ({
      onEdit: Sb.action('onEditAvatarClick'),
      onJoinTeam: Sb.action('onEditAvatarClick'),
      teamMeta: [].reduce((map, t) => {
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

const bioProps = {
  assertionKeys: [],
  backgroundColorType: 'green' as BackgroundColorType,
  notAUser: false,
  onAddIdentity: Sb.action('onAddIdentity'),
  onEditAvatar: null,
  reason: 'storybook',
  suggestionKeys: [],
  username: 'Chris',
}

const load = () => {
  proofsList()

  Sb.storiesOf('Profile/Profile', module)
    .addDecorator(provider)
    .add('BioTeamProofs', () => <BioTeamProofs {...bioProps} />)
}
export default load
