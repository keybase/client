import type * as T from '@/constants/types'
import logger from '@/logger'
import {getAccountGeneration} from '@/engine/account-generation'
import {clearModals, navigateAppend, navigateToThread} from '@/constants/router'
import {loadConversationMeta} from '../inbox/metadata'
import {toAttachmentPath} from '../conversation/attachment-path'
import {setInputIntent, type InputIntent} from '../conversation/input-intent-store'
import {sharedTextFitsAfter, writeSharedTextFile} from '@/util/shared-text-file'

// Sends a share to a conversation: its files through the attachment titles screen, its text after
// the conversation's draft. Where the text goes is decided once, against the draft as the service
// has it (the meta is loaded first; one that can't be loaded counts as an empty draft): after the
// draft when chat's message limit leaves room for both, else as a .txt in the batch, the draft
// untouched. Text that can't be written as a file goes after the draft after all.
// threadBeneath: the conversation is already shown under this, and nothing else holds the share,
// so the text goes after the draft now, and a cancelled batch can't lose it. Otherwise (the picker
// is beneath, still holding the share) it follows the files into the draft once they are sent.
// tlfName undefined takes the meta's.
export const sendShareToConversation = async (p: {
  conversationIDKey: T.Chat.ConversationIDKey
  paths: ReadonlyArray<string>
  text?: string
  notice?: string
  reason: 'extension' | 'files'
  threadBeneath: boolean
  tlfName?: string
}) => {
  const {conversationIDKey, notice, reason, text, threadBeneath, tlfName} = p
  const generation = getAccountGeneration()
  const meta = await loadConversationMeta(conversationIDKey)
  let paths = p.paths
  let afterDraft = text
  if (text !== undefined && !sharedTextFitsAfter(meta?.draft ?? '', text)) {
    try {
      paths = [...paths, (await writeSharedTextFile(text)).path]
      afterDraft = undefined
    } catch (error) {
      logger.warn('shared text: unable to write it as a file, leaving it for the draft', error)
    }
  }
  // the load or the write outlasted the account the share was for
  if (getAccountGeneration() !== generation) {
    logger.info('send share: account changed, sending nothing')
    return
  }
  const withTitles = paths.length > 0
  // a titles screen shows the notice itself
  const threadNotice = withTitles ? undefined : notice
  // the text goes after the draft now unless it follows the files from a titles screen over the picker
  const textNow = threadBeneath || !withTitles ? afterDraft : undefined
  const intent: InputIntent | undefined =
    textNow === undefined && !threadNotice
      ? undefined
      : {append: true, notice: threadNotice, text: textNow, type: 'injectText'}
  if (threadBeneath) {
    if (intent) {
      setInputIntent(conversationIDKey, intent)
    }
  } else if (!withTitles) {
    clearModals()
    navigateToThread(conversationIDKey, reason, {intent})
  }
  if (!withTitles) return
  navigateAppend({
    name: 'chatAttachmentGetTitles',
    params: {
      conversationIDKey,
      inputPrefillText: threadBeneath ? undefined : afterDraft,
      notice,
      pathAndOutboxIDs: paths.map(path => ({path: toAttachmentPath(path)})),
      selectConversationWithReason: reason,
      // the picker's own, even empty: an empty one takes the drag-and-drop upload
      tlfName: tlfName ?? (meta?.tlfname || undefined),
    },
  })
}
