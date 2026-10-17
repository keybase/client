import type * as T from '@/constants/types'
import logger from '@/logger'
import {getAccountGeneration} from '@/engine/account-generation'
import {clearModals, navigateAppend, navigateToThread} from '@/constants/router'
import {getInboxConversationMeta} from '../inbox/metadata'
import {toAttachmentPath} from '../conversation/attachment-path'
import {setInputIntent} from '../conversation/input-intent-store'
import {sharedTextFitsAfter, writeSharedTextFile} from '@/util/shared-text-file'

const knownMeta = (conversationIDKey: T.Chat.ConversationIDKey) => {
  const meta = getInboxConversationMeta(conversationIDKey)
  return meta?.conversationIDKey === conversationIDKey ? meta : undefined
}

// Where a share's text goes, decided once as the share opens, against the draft the conversation
// has then: after the draft when chat's message limit leaves room for both, else as a .txt in the
// batch, the draft untouched.
export const sharedTextFits = (conversationIDKey: T.Chat.ConversationIDKey, text: string) =>
  sharedTextFitsAfter(knownMeta(conversationIDKey)?.draft ?? '', text)

// Opens the attachment titles screen for files going to a conversation, or the conversation itself
// when there are none. Text going with them follows them into the draft once they are sent, or,
// when the draft has no room for it, goes as a .txt in the same batch. Text that can't be written
// as a file goes after the draft after all: with threadBeneath (nothing else holds the share) now,
// so cancelling the batch can't lose it, else once the files are sent. tlfName undefined takes the
// meta's.
export const sendFilesToConversation = async (p: {
  conversationIDKey: T.Chat.ConversationIDKey
  paths: ReadonlyArray<string>
  text?: string
  notice?: string
  reason: 'extension' | 'files'
  threadBeneath?: boolean
  tlfName?: string
}) => {
  const {conversationIDKey, notice, reason, text, threadBeneath, tlfName} = p
  const generation = getAccountGeneration()
  let prefill = text
  let paths = p.paths
  if (text !== undefined && !sharedTextFits(conversationIDKey, text)) {
    try {
      paths = [...paths, (await writeSharedTextFile(text)).path]
      prefill = undefined
    } catch (error) {
      logger.warn('shared text: unable to write it as a file, leaving it for the draft', error)
    }
  }
  // the write outlasted the account the share was for
  if (getAccountGeneration() !== generation) {
    logger.info('send files: account changed, not opening the titles screen')
    return
  }
  if (paths.length === 0) {
    clearModals()
    navigateToThread(conversationIDKey, reason, {
      intent:
        prefill === undefined && !notice
          ? undefined
          : {append: true, notice, text: prefill, type: 'injectText'},
    })
    return
  }
  if (threadBeneath && prefill !== undefined) {
    setInputIntent(conversationIDKey, {append: true, text: prefill, type: 'injectText'})
    prefill = undefined
  }
  navigateAppend({
    name: 'chatAttachmentGetTitles',
    params: {
      conversationIDKey,
      inputPrefillText: prefill,
      notice,
      pathAndOutboxIDs: paths.map(path => ({path: toAttachmentPath(path)})),
      selectConversationWithReason: reason,
      // the picker's own, even empty: an empty one takes the drag-and-drop upload
      tlfName: tlfName ?? (knownMeta(conversationIDKey)?.tlfname || undefined),
    },
  })
}
