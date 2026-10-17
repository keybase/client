import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import type * as T from '@/constants/types'
import ConversationList from './conversation-list/conversation-list'
import {sendShareToConversation} from './send-share'

type Props = {
  isFromShareExtension?: boolean
  text?: string // incoming share (text)
  sendPaths?: Array<string> // KBFS or incoming share (files)
}

export const SendToChat = (props: Props) => {
  const {isFromShareExtension, sendPaths, text} = props
  const onSelect = (conversationIDKey: T.Chat.ConversationIDKey, tlfName: string) => {
    C.ignorePromise(
      sendShareToConversation({
        conversationIDKey,
        paths: sendPaths ?? [],
        reason: isFromShareExtension ? 'extension' : 'files',
        text,
        threadBeneath: false,
        tlfName,
      })
    )
  }
  return <ConversationList onSelect={onSelect} />
}

const SendToChatScreen = (props: Props) => (
  <Kb.ModalScreen scroll={false} padding="none">
    <SendToChat {...props} />
  </Kb.ModalScreen>
)

export default SendToChatScreen
