// @flow
import commandMarkdown from './conversation/command-markdown/index.stories'
import confirmPayment from './payments/confirm/index.stories'
import conversationList from './conversation-list/index.stories'
import createChannel from './create-channel/index.stories'
import explodingMessageExplainer from './conversation/messages/exploding-explainer-dialog/index.stories'
import giphy from './conversation/giphy/index.stories'
import headerArea from './conversation/header-area/normal/index.stories'
import inbox from './inbox/index.stories.js'
import infoPanel from './conversation/info-panel/index.stories'
import infoPanelNotifications from './conversation/info-panel/notifications/index.stories'
import inputArea from './conversation/input-area/normal/index.stories'
import manageChannels from './manage-channels/index.stories'
import messagePopup from './conversation/messages/message-popup/index.stories'
import paymentStatus from './payments/status/index.stories'
import setExplodingMessage from './conversation/messages/set-explode-popup/index.stories'
import suggestors from './conversation/input-area/suggestors/index.stories'
import messages from './conversation/messages/index.stories'
import startConversation from './conversation/list-area/start-conversation/index.stories'
import thread from './conversation/list-area/normal/index.stories'
import typing from './conversation/input-area/normal/typing/index.stories'

const load = () => {
  ;[
    commandMarkdown,
    confirmPayment,
    conversationList,
    createChannel,
    explodingMessageExplainer,
    giphy,
    headerArea,
    inbox,
    infoPanel,
    infoPanelNotifications,
    inputArea,
    manageChannels,
    messagePopup,
    messages,
    paymentStatus,
    setExplodingMessage,
    suggestors,
    startConversation,
    thread,
    typing,
  ].forEach(load => load())
}

export default load
