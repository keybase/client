import * as T from '../types'
import * as C from '..'
import * as EngineGen from '@/actions/engine-gen-gen'

export const onEngineConnected = () => {
  const f = async () => {
    try {
      await T.RPCGen.delegateUiCtlRegisterChatUIRpcPromise()
      await T.RPCGen.delegateUiCtlRegisterLogUIRpcPromise()
      console.log('Registered Chat UI')
    } catch (error) {
      console.warn('Error in registering Chat UI:', error)
    }
  }
  C.ignorePromise(f())
}

export const onEngineIncoming = (action: EngineGen.Actions) => {
  switch (action.type) {
    case EngineGen.chat1ChatUiChatInboxFailed:
    case EngineGen.chat1NotifyChatChatSetConvSettings:
    case EngineGen.chat1NotifyChatChatAttachmentUploadStart:
    case EngineGen.chat1NotifyChatChatPromptUnfurl:
    case EngineGen.chat1NotifyChatChatPaymentInfo:
    case EngineGen.chat1NotifyChatChatRequestInfo:
    case EngineGen.chat1NotifyChatChatAttachmentDownloadProgress:
    case EngineGen.chat1NotifyChatChatAttachmentDownloadComplete:
    case EngineGen.chat1NotifyChatChatAttachmentUploadProgress:
    case EngineGen.chat1ChatUiChatCommandMarkdown:
    case EngineGen.chat1ChatUiChatGiphyToggleResultWindow:
    case EngineGen.chat1ChatUiChatCommandStatus:
    case EngineGen.chat1ChatUiChatBotCommandsUpdateStatus:
    case EngineGen.chat1ChatUiChatGiphySearchResults:
    case EngineGen.chat1NotifyChatChatParticipantsInfo:
    case EngineGen.chat1ChatUiChatMaybeMentionUpdate:
    case EngineGen.chat1NotifyChatChatConvUpdate:
    case EngineGen.chat1ChatUiChatCoinFlipStatus:
    case EngineGen.chat1NotifyChatChatThreadsStale:
    case EngineGen.chat1NotifyChatChatSubteamRename:
    case EngineGen.chat1NotifyChatChatTLFFinalize:
    case EngineGen.chat1NotifyChatChatIdentifyUpdate:
    case EngineGen.chat1ChatUiChatInboxUnverified:
    case EngineGen.chat1NotifyChatChatInboxSyncStarted:
    case EngineGen.chat1NotifyChatChatInboxSynced:
    case EngineGen.chat1ChatUiChatInboxLayout:
    case EngineGen.chat1NotifyChatChatInboxStale:
    case EngineGen.chat1ChatUiChatInboxConversation:
    case EngineGen.chat1NotifyChatNewChatActivity:
    case EngineGen.chat1NotifyChatChatTypingUpdate:
    case EngineGen.chat1NotifyChatChatSetConvRetention:
    case EngineGen.chat1NotifyChatChatSetTeamRetention:
    case EngineGen.keybase1NotifyBadgesBadgeState:
    case EngineGen.keybase1GregorUIPushState:
      {
        const {storeRegistry} = require('../store-registry')
        storeRegistry.getState('chat').dispatch.onEngineIncomingImpl(action)
      }
      break
    default:
  }
}
