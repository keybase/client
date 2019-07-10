import commandMarkdown from './conversation/command-markdown/index.stories'
import commandStatus from './conversation/command-status/index.stories'
import confirmPayment from './payments/confirm/index.stories'
import conversationList from './conversation-list/index.stories'
import createChannel from './create-channel/index.stories'
import explodingMessageExplainer from './conversation/messages/exploding-explainer-dialog/index.stories'
import giphy from './conversation/giphy/index.stories'
import headerArea from './conversation/header-area/normal/index.stories'
import inbox from './inbox/index.stories'
import infoPanel from './conversation/info-panel/index.stories'
import infoPanelNotifications from './conversation/info-panel/notifications/index.stories'
import inputArea from './conversation/input-area/normal/index.stories'
import manageChannels from './manage-channels/index.stories'
import messagePopup from './conversation/messages/message-popup/index.stories'
import paymentStatus from './payments/status/index.stories'
import replyPreview from './conversation/reply-preview/index.stories'
import setExplodingMessage from './conversation/messages/set-explode-popup/index.stories'
import suggestors from './conversation/input-area/suggestors/index.stories'
import messages from './conversation/messages/index.stories'
import thread from './conversation/list-area/normal/index.stories'
import threadSearch from './conversation/search/index.stories'
import typing from './conversation/input-area/normal/typing/index.stories'

const load = () => {
  ;[
    commandMarkdown,
    commandStatus,
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
    replyPreview,
    setExplodingMessage,
    suggestors,
    thread,
    threadSearch,
    typing,
  ].forEach(load => load())
}

export default load
