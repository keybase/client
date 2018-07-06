// @flow
import channelMentionHud from './conversation/input-area/channel-mention-hud/index.stories'
import createChannel from './create-channel/index.stories'
import inbox from './inbox/index.stories.js'
import infoPanel from './conversation/info-panel/index.stories'
import infoPanelNotifications from './conversation/info-panel/notifications/index.stories'
import inputArea from './conversation/input-area/normal/index.stories'
import manageChannels from './manage-channels/index.stories'
import messagePopup from './conversation/messages/message-popup/index.stories'
import sendAnimation from './conversation/messages/wrapper/chat-send.stories'
import setExplodingMessage from './conversation/messages/set-explode-popup/index.stories'
import userMentionHud from './conversation/input-area/user-mention-hud/index.stories'
import messages from './conversation/messages/index.stories'
import startConversation from './conversation/list-area/start-conversation/index.stories'
import thread from './conversation/list-area/normal/index.stories'

const load = () => {
  ;[
    channelMentionHud,
    createChannel,
    inbox,
    infoPanel,
    infoPanelNotifications,
    inputArea,
    manageChannels,
    messagePopup,
    messages,
    sendAnimation,
    setExplodingMessage,
    userMentionHud,
    startConversation,
    thread,
  ].forEach(load => load())
}

export default load
