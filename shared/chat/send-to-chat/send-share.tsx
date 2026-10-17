import type * as T from '@/constants/types'
import logger from '@/logger'
import {getAccountGeneration} from '@/engine/account-generation'
import {navigateAppend} from '@/constants/router'
import {getInboxConversationMeta} from '../inbox/metadata'
import {toAttachmentPath} from '../conversation/attachment-path'
import {sharedTextForBatch} from '@/util/shared-text-file'

// Opens the attachment titles screen for files going to a conversation. Text going with them
// follows them into the draft, or, when the draft has no room for it, goes as a .txt in the same
// batch. textBack: that text comes back after the draft if the batch is cancelled, for a screen
// with nothing else holding the share beneath it.
export const sendFilesToConversation = async (p: {
  conversationIDKey: T.Chat.ConversationIDKey
  paths: ReadonlyArray<string>
  text?: string
  notice?: string
  reason: 'extension' | 'files'
  textBack: boolean
  tlfName?: string
}) => {
  const {conversationIDKey, notice, paths, reason, text, textBack, tlfName} = p
  const generation = getAccountGeneration()
  const meta = getInboxConversationMeta(conversationIDKey)
  const ours = meta?.conversationIDKey === conversationIDKey ? meta : undefined
  const shared = await sharedTextForBatch(ours?.draft ?? '', text)
  // the write outlasted the account the share was for
  if (getAccountGeneration() !== generation) {
    logger.info('send files: account changed, not opening the titles screen')
    return
  }
  navigateAppend({
    name: 'chatAttachmentGetTitles',
    params: {
      conversationIDKey,
      inputPrefillText: shared.text,
      notice,
      pathAndOutboxIDs: [...paths, ...(shared.path ? [shared.path] : [])].map(path => ({
        path: toAttachmentPath(path),
      })),
      selectConversationWithReason: reason,
      textBack: shared.path && textBack ? text : undefined,
      tlfName: tlfName || ours?.tlfname || undefined,
    },
  })
}
