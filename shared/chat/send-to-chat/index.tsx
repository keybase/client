import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import type * as T from '@/constants/types'
import ConversationList from './conversation-list/conversation-list'
import {toAttachmentPath} from '../conversation/attachment-path'
import {getInboxConversationMeta} from '../inbox/metadata'
import {sharedTextForBatch} from '@/util/shared-text-file'

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
      const meta = getInboxConversationMeta(conversationIDKey)
      const draft = meta?.conversationIDKey === conversationIDKey ? meta.draft : undefined
      const f = async () => {
        const shared = await sharedTextForBatch(draft ?? '', text)
        navigateAppend({
          name: 'chatAttachmentGetTitles',
          params: {
            conversationIDKey,
            inputPrefillText: shared.text,
            pathAndOutboxIDs: [...sendPaths, ...(shared.path ? [shared.path] : [])].map(p => ({
              path: toAttachmentPath(p),
            })),
            selectConversationWithReason: isFromShareExtension ? 'extension' : 'files',
            tlfName,
          },
        })
      }
      C.ignorePromise(f())
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
