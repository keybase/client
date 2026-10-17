import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import type * as T from '@/constants/types'
import ConversationList from './conversation-list/conversation-list'
import {sendFilesToConversation} from './send-share'

type Props = {
  isFromShareExtension?: boolean
  text?: string // incoming share (text)
  sendPaths?: Array<string> // KBFS or incoming share (files)
}

export const SendToChat = (props: Props) => {
  const {isFromShareExtension, sendPaths, text} = props
  const clearModals = C.Router2.clearModals
  const onSelect = (conversationIDKey: T.Chat.ConversationIDKey, tlfName: string) => {
    if (sendPaths?.length) {
      C.ignorePromise(
        sendFilesToConversation({
          conversationIDKey,
          paths: sendPaths,
          reason: isFromShareExtension ? 'extension' : 'files',
          text,
          // a cancel comes back to this list, which still holds the share
          textBack: false,
          tlfName,
        })
      )
    } else {
      clearModals()
      C.Router2.navigateToThread(conversationIDKey, isFromShareExtension ? 'extension' : 'files', {
        intent: text === undefined ? undefined : {append: true, text, type: 'injectText'},
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
