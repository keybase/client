import * as C from '@/constants'
import * as Chat from '@/stores/chat2'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import Banner from '../bottom-banner'
import InputArea from '../input-area/container'
import InvitationToBlock from '@/chat/blocking/invitation-to-block'
import ListArea from '../list-area'
import PinnedMessage from '../pinned-message'
import ThreadLoadStatus from '../load-status'
import ThreadSearch from '../search'
import {readImageFromClipboard} from '@/util/clipboard.desktop'
import '../conversation.css'
import {indefiniteArticle} from '@/util/string'

const Offline = () => (
  <Kb.Banner color="grey" small={true} style={styles.offline}>
    {"Couldn't load all chat messages due to network connectivity. Retrying..."}
  </Kb.Banner>
)

const LoadingLine = () => {
  const conversationIDKey = Chat.useChatContext(s => s.id)
  const showLoader = C.Waiting.useAnyWaiting([
    C.waitingKeyChatThreadLoad(conversationIDKey),
    C.waitingKeyChatInboxSyncStarted,
  ])
  return showLoader ? <Kb.LoadingLine /> : null
}

const Conversation = React.memo(function Conversation() {
  const conversationIDKey = Chat.useChatContext(s => s.id)
  const navigateAppend = Chat.useChatNavigateAppend()
  const onAttach = React.useCallback(
    (paths: Array<string>) => {
      const pathAndOutboxIDs = paths.map(p => ({path: p}))
      navigateAppend(conversationIDKey => ({
        props: {conversationIDKey, pathAndOutboxIDs},
        selected: 'chatAttachmentGetTitles',
      }))
    },
    [navigateAppend]
  )
  const showThreadSearch = Chat.useChatContext(s => s.threadSearchInfo.visible)
  const cannotWrite = Chat.useChatContext(s => s.meta.cannotWrite)
  const threadLoadedOffline = Chat.useChatContext(s => s.meta.offline)
  const dragAndDropRejectReason = Chat.useChatContext(s => {
    const meta = s.meta
    const {cannotWrite, minWriterRole} = meta
    return cannotWrite
      ? `You must be at least ${indefiniteArticle(minWriterRole)} ${minWriterRole} to post.`
      : undefined
  })
  const attachmentPasted = Chat.useChatContext(s => s.dispatch.attachmentPasted)
  const onPaste = React.useCallback(
    (e: React.SyntheticEvent) => {
      readImageFromClipboard(e)
        .then(clipboardData => {
          if (clipboardData) {
            attachmentPasted(clipboardData)
          }
        })
        .catch(() => {})
    },
    [attachmentPasted]
  )
  const toggleThreadSearch = Chat.useChatContext(s => s.dispatch.toggleThreadSearch)
  const onToggleThreadSearch = React.useCallback(() => {
    toggleThreadSearch()
  }, [toggleThreadSearch])
  Kb.useHotKey('mod+f', onToggleThreadSearch)

  return (
    <div className="conversation" style={styles.container} onPaste={onPaste} key={conversationIDKey}>
      <Kb.DragAndDrop
        onAttach={cannotWrite ? undefined : onAttach}
        fullHeight={true}
        fullWidth={true}
        rejectReason={dragAndDropRejectReason}
      >
        {threadLoadedOffline && <Offline />}
        <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} style={styles.innerContainer}>
          <ListArea />
          <Kb.Box2 direction="vertical" fullWidth={true} style={{left: 0, position: 'absolute', top: 0}}>
            <ThreadLoadStatus />
            {!showThreadSearch && <PinnedMessage />}
          </Kb.Box2>
          {showThreadSearch && <ThreadSearch style={styles.threadSearchStyle} />}
          <LoadingLine />
        </Kb.Box2>
        <InvitationToBlock />
        <Banner />
        <InputArea />
      </Kb.DragAndDrop>
    </div>
  )
})

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      container: {
        ...Kb.Styles.globalStyles.flexBoxColumn,
        flex: 1,
        position: 'relative',
      },
      innerContainer: {
        flex: 1,
        position: 'relative',
      },
      offline: {
        padding: Kb.Styles.globalMargins.xxtiny,
      },
      threadSearchStyle: {
        position: 'absolute' as const,
        top: 0,
      },
    }) as const
)

export default Conversation
