// @flow
import channelMentionHud from './conversation/input-area/channel-mention-hud/index.stories'
import createChannel from './create-channel/index.stories'
import inboxRow from './inbox/row/index.stories'
import infoPanel from './conversation/info-panel/index.stories'
import infoPanelNotifications from './conversation/info-panel/notifications/index.stories'
import inputArea from './conversation/input-area/index.stories'
import manageChannels from './manage-channels/index.stories'
import sendAnimation from './conversation/messages/wrapper/chat-send.stories'
import setExplodingMessage from './conversation/messages/set-explode-popup/index.stories'
import userMentionHud from './conversation/input-area/user-mention-hud/index.stories'

const load = () => {
  ;[
    channelMentionHud,
    createChannel,
    inboxRow,
    infoPanel,
    infoPanelNotifications,
    inputArea,
    manageChannels,
    sendAnimation,
    setExplodingMessage,
    userMentionHud,
  ].forEach(load => load())
}

export default load
