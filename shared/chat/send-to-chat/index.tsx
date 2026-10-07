import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import type * as T from '@/constants/types'
import ConversationList from './conversation-list/conversation-list'
import {toAttachmentPath} from '../conversation/attachment-path'

type Props = {
  isFromShareExtension?: boolean
  text?: string // incoming share (text)
  sendPaths?: Array<string> // KBFS or incoming share (files)
}

export const SendToChat = (props: Props) => {
  const {isFromShareExtension, sendPaths, text} = props
  const navigateAppend = C.Router2.navigateAppend
  const clearModals = C.Router2.clearModals
  const onSelect = (conversationIDKey: T.Chat.ConversationIDKey, tlfName: string) => {
    if (sendPaths?.length) {
      navigateAppend({
        name: 'chatAttachmentGetTitles',
        params: {
          conversationIDKey,
          inputPrefillText: text,
          pathAndOutboxIDs: sendPaths.map(p => ({path: toAttachmentPath(p)})),
          selectConversationWithReason: isFromShareExtension ? 'extension' : 'files',
          tlfName,
        },
      })
    } else {
      clearModals()
      C.Router2.navigateToThread(conversationIDKey, isFromShareExtension ? 'extension' : 'files', {
        intent: text === undefined ? undefined : {text, type: 'injectText'},
      })
    }
  }
  return <ConversationList onSelect={onSelect} />
}

const SendToChatScreen = (props: Props) => (
  <Kb.ModalScreen scroll={false} padding="none">
    <SendToChat {...props} />
  </Kb.ModalScreen>
)

export default SendToChatScreen
