import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as React from 'react'
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
  // a pick being sent (its draft loading, its text being written) takes no other pick
  const sendingRef = React.useRef(false)
  const onSelect = (conversationIDKey: T.Chat.ConversationIDKey, tlfName: string) => {
    if (sendingRef.current) return
    sendingRef.current = true
    C.ignorePromise(
      sendShareToConversation({
        conversationIDKey,
        paths: sendPaths ?? [],
        reason: isFromShareExtension ? 'extension' : 'files',
        text,
        threadBeneath: false,
        tlfName,
      }).finally(() => {
        sendingRef.current = false
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
