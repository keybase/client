import * as React from 'react'
import * as Sb from '../../../stories/storybook'
import * as Constants from '../../../constants/chat2'
import * as RPCChatTypes from '../../../constants/types/rpc-chat-gen'
import {retentionPolicies} from '../../../constants/teams'
import {Box} from '../../../common-adapters'
import {globalStyles} from '../../../styles'
import {InfoPanel, InfoPanelProps} from '.'
import addToChannel from './add-to-channel/index.stories'
import {CaptionedDangerIcon} from './channel-utils'

const onlyValidConversationsProps = {
  conversationIDKey: 'fake key',
}

const notificationProps = {
  _muteConversation: Sb.action('_muteConversation'),
  _storeChannelWide: false,
  _storeDesktop: 'onWhenAtMentioned',
  _storeMobile: 'never',
  _storeMuted: false,
  _updateNotifications: Sb.action('_updateNotifications'),
}

const minWriterRoleProps = {
  canSetMinWriterRole: false,
  minWriterRole: 'reader',
}

const retentionPickerPropSelector = props => ({
  _loadTeamOperations: Sb.unexpected('_loadTeamOperations'),
  _loadTeamPolicy: Sb.action('_loadTeamPolicy'),
  _onShowDropdown: Sb.action('onShowDropdownRetentionPicker'),
  _onShowWarning: Sb.action('onShowWarningRetentionPicker'),
  _parentPath: 'mockedParentPath',
  _permissionsLoaded: true,
  canSetPolicy: true,
  containerStyle: props.containerStyle,
  dropdownStyle: props.dropdownStyle,
  entityType: props.entityType,
  isSmallTeam: props.isSmallTeam,
  isTeamWide: props.isTeamWide,
  loading: false,
  onSelect: Sb.action('onSelectRetentionPolicy'),
  policy: retentionPolicies.policyThreeMonths,
  setRetentinPolicy: Sb.action('setRetentionPolicy'),
  teamPolicy: retentionPolicies.policyMonth,
  type: props.type,
})

const provider = Sb.createPropProviderWithCommon({
  ...Sb.PropProviders.TeamDropdownMenu(),
  AddPeople: p => ({
    isAdmin: p.isAdmin,
    isGeneralChannel: p.isGeneralChannel,
    onAddPeople: Sb.action('onAddPeople'),
    onAddToChannel: Sb.action('onAddToChannel'),
  }),
  InfoPanel: (props: InfoPanelProps) => props,
  LifecycleNotifications: () => notificationProps,
  MinWriterRole: () => minWriterRoleProps,
  OnlyValidConversations: () => onlyValidConversationsProps,
  RetentionPicker: retentionPickerPropSelector,
})

const makeThumbs = () => {
  const thumb = {
    ctime: 1542241021655,
    height: 320,
    isVideo: false,
    onClick: Sb.action('onMediaClick'),
    previewURL: require('../../../images/mock/wsj_image.jpg').default,
    width: 180,
  }
  const l: Array<typeof thumb> = []
  for (let i = 0; i < 60; i++) {
    l.push(thumb)
  }
  return l
}

const makeDocs = () => {
  const doc = {
    author: 'mikem',
    ctime: 1542241021655,
    downloading: false,
    name: 'End of the Year Report',
    onDownload: Sb.action('onDownload'),
    onShowInFinder: null,
    progress: 0,
  }
  const downloadingDoc = {
    author: 'mikem',
    ctime: 1542241021655,
    downloading: true,
    name: 'End of the Year Report',
    onDownload: Sb.action('onDownload'),
    onShowInFinder: null,
    progress: 0.4,
  }
  const downloadedDoc = {
    author: 'mikem',
    ctime: 1542241021655,
    downloading: false,
    name: 'End of the Year Report',
    onDownload: Sb.action('onDownload'),
    onShowInFinder: Sb.action('onShowInFinder'),
    progress: 0,
  }
  const docs: Array<typeof doc> = []
  docs.push(doc)
  docs.push(downloadingDoc)
  docs.push(downloadedDoc)
  return docs
}

const makeLinks = (): any => {
  const bareLink = {
    author: 'mikem',
    ctime: 1542241021655,
    snippet:
      'TestImplicitTeamResetAll` flake known? $>kb$eyJ0eXAiOjQsImxpbmsiOnsiZGlzcGxheSI6Imh0dHBzOi8vY2kua2V5YmEuc2Uvam9iL2NsaWVudC9qb2IvUFItMTc2ODgvNy9leGVjdXRpb24vbm9kZS80NzAvbG9nLz9jb25zb2xlRnVsbCIsInVybCI6Imh0dHBzOi8vY2kua2V5YmEuc2Uvam9iL2NsaWVudC9qb2IvUFItMTc2ODgvNy9leGVjdXRpb24vbm9kZS80NzAvbG9nLz9jb25zb2xlRnVsbCJ9fQ==$<kb$',
  }
  const unfurlLink = {
    author: 'mikem',
    ctime: 1542241021655,
    snippet:
      'TestImplicitTeamResetAll` flake known? $>kb$eyJ0eXAiOjQsImxpbmsiOnsiZGlzcGxheSI6Imh0dHBzOi8vY2kua2V5YmEuc2Uvam9iL2NsaWVudC9qb2IvUFItMTc2ODgvNy9leGVjdXRpb24vbm9kZS80NzAvbG9nLz9jb25zb2xlRnVsbCIsInVybCI6Imh0dHBzOi8vY2kua2V5YmEuc2Uvam9iL2NsaWVudC9qb2IvUFItMTc2ODgvNy9leGVjdXRpb24vbm9kZS80NzAvbG9nLz9jb25zb2xlRnVsbCJ9fQ==$<kb$',
    title: 'Google this failure',
    url: 'https://www.google.com',
  }
  const links: Array<typeof bareLink> = []
  links.push(bareLink)
  links.push(unfurlLink)
  return links
}

const commonProps = {
  canDeleteHistory: true,
  canSetMinWriterRole: false,
  docs: {
    docs: makeDocs(),
    onLoadMore: Sb.action('onLoadMore'),
    status: 'success',
  } as any,
  ignored: false,
  links: {
    links: makeLinks(),
    onLoadMore: Sb.action('onLoadMore'),
    status: 'success',
  },
  media: {
    onLoadMore: Sb.action('onLoadMore'),
    status: 'success',
    thumbs: makeThumbs(),
  },
  onBack: Sb.unexpected('onBack'),
  onHideConv: Sb.action(`onHideConv`),
  onShowProfile: (username: string) => Sb.action(`onShowProfile(${username})`),
  onUnhideConv: Sb.action(`onUnhideConv`),
  participants: [
    {
      fullname: 'Fred Akalin',
      isAdmin: true,
      isOwner: true,
      username: 'akalin',
    },
    {
      fullname: 'Jeremy Stribling',
      isAdmin: true,
      isOwner: false,
      username: 'strib',
    },
    {
      fullname: 'Max Krohn',
      isAdmin: false,
      isOwner: false,
      username: 'max',
    },
  ],
  selectedConversationIDKey: Constants.noConversationIDKey,
  spinnerForHide: false,
} as const

const conversationProps = {
  ...commonProps,
  admin: false,
  canEditChannel: true,
  canSetRetention: false,
  channelname: undefined,
  description: "You shouldn't be seeing this",
  isPreview: false,
  onAttachmentViewChange: Sb.action('onAttachmentViewChange'),
  onEditChannel: Sb.unexpected('onEditChannel'),
  onJoinChannel: Sb.unexpected('onJoinChannel'),
  onLeaveConversation: Sb.unexpected('onLeaveConversation'),
  onSelectTab: Sb.action('onSelectTab'),
  onShowBlockConversationDialog: Sb.action('onShowBlockConversationDialog'),
  onShowClearConversationDialog: Sb.action('onShowClearConversationDialog'),
  onShowNewTeamDialog: Sb.action('onShowNewTeamDialog'),
  selectedAttachmentView: RPCChatTypes.GalleryItemTyp.media,
  selectedTab: 'attachments',
  smallTeam: false,
  teamname: undefined,
} as const

const teamCommonProps = {
  ...commonProps,
  canEditChannel: true,
  canSetRetention: true,
  channelname: 'somechannel',
  onAttachmentViewChange: Sb.action('onAttachmentViewChange'),
  onSelectTab: Sb.action('onSelectTab'),
  onShowBlockConversationDialog: Sb.unexpected('onShowBlockConversationDialog'),
  onShowClearConversationDialog: Sb.unexpected('onShowClearConversationDialog'),
  onShowNewTeamDialog: Sb.unexpected('onShowNewTeamDialog'),
  selectedAttachmentView: RPCChatTypes.GalleryItemTyp.media,
  selectedTab: 'settings',
  teamname: 'someteam',
} as const

const smallTeamProps = {
  ...teamCommonProps,
  admin: false,
  channelname: 'general',
  description: 'You should be seeing this',
  isPreview: false,
  onEditChannel: Sb.unexpected('onEditChannel'),
  onJoinChannel: Sb.unexpected('onJoinChannel'),
  onLeaveConversation: Sb.unexpected('onLeaveConversation'),
  smallTeam: true,
} as const

const bigTeamCommonProps = {
  ...teamCommonProps,
  admin: false,
  description: 'The best channel. /keybase/team/kbkbfstest.sub/best-folder',
  onEditChannel: Sb.action('onEditChannel'),
  smallTeam: false,
} as const

const bigTeamPreviewProps = {
  ...bigTeamCommonProps,
  admin: false,
  channelname: 'somechannel',
  isPreview: true,
  onJoinChannel: Sb.action('onJoinChannel'),
  onLeaveConversation: Sb.unexpected('onLeaveConversation'),
  smallTeam: false,
} as const

const bigTeamNoPreviewProps = {
  ...bigTeamCommonProps,
  admin: false,
  channelname: 'somechannel',
  isPreview: false,
  onJoinChannel: Sb.unexpected('onJoinChannel'),
  onLeaveConversation: Sb.action('onLeaveConversation'),
  smallTeam: false,
}

const bigTeamLotsaUsersCommonProps = {
  ...bigTeamNoPreviewProps,
  participants: new Array(100).fill(0).map(
    (_, i) =>
      ({
        fullname: `Agent ${i}`,
        isAdmin: false,
        isOwner: false,
        username: `agnt${i}`,
      } as const)
  ),
}

const hideSpinnerLayout = () => (
  <Box>
    <CaptionedDangerIcon
      key="hf"
      caption="Hide this conversation"
      noDanger={true}
      onClick={Sb.action('hide')}
      icon="iconfont-remove"
      spinner={false}
    />
    <CaptionedDangerIcon
      key="ht"
      caption="Hide this conversation"
      noDanger={true}
      onClick={Sb.action('hide')}
      icon="iconfont-remove"
      spinner={true}
    />
    <CaptionedDangerIcon
      key="uf"
      caption="Unhide this conversation"
      onClick={Sb.action('unhide')}
      noDanger={true}
      spinner={false}
    />
    <CaptionedDangerIcon
      key="ut"
      caption="Unhide this conversation"
      onClick={Sb.action('unhide')}
      noDanger={true}
      spinner={true}
    />
  </Box>
)

const load = () => {
  addToChannel()

  Sb.storiesOf('Chat/Conversation/InfoPanel', module)
    .addDecorator(provider)
    .addDecorator(story => (
      <Box style={{...globalStyles.flexBoxColumn, height: 500, width: 320}}>{story()}</Box>
    ))
    .add('Adhoc conv (settings)', () => <InfoPanel {...conversationProps} selectedTab="settings" />)
    .add('Adhoc conv (settings/hidden)', () => (
      <InfoPanel {...conversationProps} selectedTab="settings" ignored={true} />
    ))
    .add('Adhoc conv (settings/spinning hide)', () => (
      <InfoPanel {...conversationProps} selectedTab="settings" spinnerForHide={true} />
    ))
    .add('Small team', () => <InfoPanel {...smallTeamProps} />)
    .add('Small team (hidden)', () => <InfoPanel {...smallTeamProps} ignored={true} />)
    .add('Small team (attach/media)', () => <InfoPanel {...smallTeamProps} selectedTab="attachments" />)
    .add('Small team (attach/docs)', () => (
      <InfoPanel
        {...smallTeamProps}
        selectedAttachmentView={RPCChatTypes.GalleryItemTyp.doc}
        selectedTab="attachments"
      />
    ))
    .add('Small team (attach/links)', () => (
      <InfoPanel
        {...smallTeamProps}
        selectedAttachmentView={RPCChatTypes.GalleryItemTyp.link}
        selectedTab="attachments"
      />
    ))
    .add('Big team lotsa users', () => <InfoPanel {...bigTeamLotsaUsersCommonProps} selectedTab="members" />)
    .add('Big team preview', () => <InfoPanel {...bigTeamPreviewProps} selectedTab="members" />)
    .add('Big team no preview', () => <InfoPanel {...bigTeamNoPreviewProps} selectedTab="members" />)
    .add('Hide/unhide spinner layout', hideSpinnerLayout)
}

export default load
