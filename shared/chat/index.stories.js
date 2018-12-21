// @flow
import createChannel from './create-channel/index.stories'
import inbox from './inbox/index.stories.js'
import infoPanel from './conversation/info-panel/index.stories'
import infoPanelNotifications from './conversation/info-panel/notifications/index.stories'
import inputArea from './conversation/input-area/normal/index.stories'
import manageChannels from './manage-channels/index.stories'
import messagePopup from './conversation/messages/message-popup/index.stories'
import setExplodingMessage from './conversation/messages/set-explode-popup/index.stories'
import suggestors from './conversation/input-area/suggestors/index.stories'
import messages from './conversation/messages/index.stories'
import startConversation from './conversation/list-area/start-conversation/index.stories'
import thread from './conversation/list-area/normal/index.stories'
import headerArea from './conversation/header-area/normal/index.stories'
import confirmPayment from './payments/confirm/index.stories'
import paymentStatus from './payments/status/index.stories'

const load = () => {
  ;[
    createChannel,
    inbox,
    infoPanel,
    infoPanelNotifications,
    inputArea,
    manageChannels,
    messagePopup,
    messages,
    setExplodingMessage,
    suggestors,
    startConversation,
    thread,
    headerArea,
    confirmPayment,
    paymentStatus,
  ].forEach(load => load())
}

export default load
