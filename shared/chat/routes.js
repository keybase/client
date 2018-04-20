// @flow
import AddPeopleHow from '../teams/team/header/add-people-how/container'
import AttachmentGetTitles from './conversation/attachment-get-titles/container'
import AttachmentFullscreen from './conversation/attachment-fullscreen/container'
import BlockConversationWarning from './conversation/block-conversation-warning/container'
import Conversation from './conversation/container'
import CreateChannel from './create-channel/container'
import EditChannel from './manage-channels/edit-channel-container'
import EnterPaperkey from './conversation/rekey/enter-paper-key'
import Inbox from './inbox/container'
import InfoPanel from './conversation/info-panel/container'
import InfoPanelMenu from './conversation/info-panel/menu/container'
import ManageChannels from './manage-channels/container'
import MessagePopup from './conversation/messages/message-popup'
import NewTeamDialogFromChat from './new-team-dialog-container'
import ReallyLeaveTeam from '../teams/really-leave-team/container-chat'
import RelativePopupHoc from '../common-adapters/relative-popup-hoc'
import InboxAndConversation from './inbox-and-conversation'
import {MaybePopupHoc} from '../common-adapters'
import {isMobile} from '../constants/platform'
import {makeRouteDefNode, makeLeafTags} from '../route-tree'
import DeleteHistoryWarning from './delete-history-warning/container'
import RetentionDropdown from '../teams/team/settings-tab/retention/dropdown'
import RetentionWarning from '../teams/team/settings-tab/retention/warning/container'

const editChannel = {
  component: MaybePopupHoc(isMobile)(EditChannel),
  tags: makeLeafTags({hideStatusBar: isMobile, layerOnTop: !isMobile}),
  children: {},
}

const manageChannels = {
  component: ManageChannels,
  tags: makeLeafTags({hideStatusBar: isMobile, layerOnTop: !isMobile}),
  children: {
    editChannel,
  },
}

const retentionDropdown = {
  component: isMobile ? RetentionDropdown : RelativePopupHoc(RetentionDropdown),
  children: {},
  tags: makeLeafTags({layerOnTop: true}),
}

const retentionWarning = {
  component: RetentionWarning,
  children: {},
  tags: makeLeafTags({layerOnTop: !isMobile}),
}

const infoPanelChildren = {
  addPeopleHow: {
    children: {},
    component: isMobile ? AddPeopleHow : RelativePopupHoc(AddPeopleHow),
    tags: makeLeafTags({layerOnTop: true}),
  },
  editChannel,
  infoPanelMenu: {
    children: {},
    component: isMobile ? InfoPanelMenu : RelativePopupHoc(InfoPanelMenu),
    tags: makeLeafTags({layerOnTop: true}),
  },
  manageChannels,
  reallyLeaveTeam: {
    children: {},
    component: ReallyLeaveTeam,
    tags: makeLeafTags({layerOnTop: !isMobile}),
  },
  retentionDropdown,
  retentionWarning,
  showBlockConversationDialog: {
    component: BlockConversationWarning,
    tags: makeLeafTags({hideStatusBar: isMobile, layerOnTop: !isMobile}),
    children: {},
  },
  showNewTeamDialog: {
    component: NewTeamDialogFromChat,
    tags: makeLeafTags({layerOnTop: !isMobile}),
    children: {},
  },
}

const conversationRoute = makeRouteDefNode({
  component: Conversation,
  children: {
    attachmentFullscreen: {
      component: AttachmentFullscreen,
      tags: makeLeafTags(isMobile ? {hideStatusBar: true, fullscreen: true} : {layerOnTop: true}),
      children: {
        messageAction: {
          component: RelativePopupHoc(MessagePopup),
          children: {},
          tags: makeLeafTags({layerOnTop: true}),
        },
      },
    },
    attachmentGetTitles: {
      component: AttachmentGetTitles,
      tags: makeLeafTags({layerOnTop: true}),
      children: {},
    },
    infoPanel: {
      component: InfoPanel,
      children: infoPanelChildren,
      tags: makeLeafTags({gatewayName: 'retention-dropdown'}),
    },
    // We should consolidate these as only info panel children once it's changed to a route on desktop
    ...infoPanelChildren,
    deleteHistoryWarning: {
      component: DeleteHistoryWarning,
      tags: makeLeafTags({layerOnTop: false}),
      children: {},
    },
    messageAction: {
      component: RelativePopupHoc(MessagePopup),
      tags: makeLeafTags({layerOnTop: true}),
      children: {},
    },
    createChannel: {
      component: CreateChannel,
      tags: makeLeafTags({layerOnTop: true}),
      children: {},
    },

    enterPaperkey: {
      component: EnterPaperkey,
    },
  },
})

// [mobile] we assume children of the inbox are conversations. manageChannels and createChannel are
// the only screens you can get to without going through a conversation, so we substitute them in
// manually and route to a conversation otherwise
const manageChannelsRoute = makeRouteDefNode({
  component: ManageChannels,
  children: {
    editChannel: {
      component: EditChannel,
      tags: makeLeafTags({hideStatusBar: true, layerOnTop: false}),
      children: {},
    },
  },
  tags: makeLeafTags({hideStatusBar: true}),
})
const createChannelRoute = makeRouteDefNode({
  component: CreateChannel,
  tags: makeLeafTags({hideStatusBar: true}),
  children: {},
})
const infoPanelMenuRoute = makeRouteDefNode({
  children: {},
  component: isMobile ? InfoPanelMenu : RelativePopupHoc(InfoPanelMenu),
  tags: makeLeafTags({layerOnTop: true}),
})

const routeTree = isMobile
  ? makeRouteDefNode({
      component: Inbox,
      children: key => {
        if (key === 'manageChannels') {
          return manageChannelsRoute
        } else if (key === 'createChannel') {
          return createChannelRoute
        } else if (key === 'infoPanelMenu') {
          return infoPanelMenuRoute
        }

        return conversationRoute
      },
      tags: makeLeafTags({persistChildren: true, gatewayName: 'retention-dropdown'}),
    })
  : makeRouteDefNode({
      containerComponent: InboxAndConversation,
      defaultSelected: '0',
      children: () => conversationRoute,
      tags: makeLeafTags({persistChildren: true, gatewayName: 'retention-dropdown'}),
      initialState: {smallTeamsExpanded: false},
    })

export default routeTree
