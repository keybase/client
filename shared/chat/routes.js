// @flow
import {RouteDefNode} from '../route-tree'
import ConversationList from './conversations-list/container'
import Conversation from './conversation/container'
import AttachmentPopup from './conversation/attachment-popup/container'
import QuickSearch from './conversation/quick-search/container'
import {nothingSelected} from '../constants/chat'

const conversationRoute = new RouteDefNode({
  component: Conversation,
  children: {
    attachment: {
      component: AttachmentPopup,
      tags: {layerOnTop: true},
      children: {},
    },
    quickSearch: {
      component: QuickSearch,
      tags: {layerOnTop: true},
      children: {},
    }
  },
})

const routeTree = new RouteDefNode({
  containerComponent: ConversationList,
  defaultSelected: nothingSelected,
  children: () => conversationRoute,
})

export default routeTree
