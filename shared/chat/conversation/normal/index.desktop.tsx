import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import Banner from '../bottom-banner/container'
import InputArea from '../input-area/container'
import InvitationToBlock from '@/chat/blocking/invitation-to-block'
import ListArea from '../list-area'
import PinnedMessage from '../pinned-message/container'
import ThreadLoadStatus from '../load-status'
import ThreadSearch from '../search/container'
import {readImageFromClipboard} from '@/util/clipboard.desktop'
import '../conversation.css'
import {indefiniteArticle} from '@/util/string'

const Offline = () => (
  <Kb.Banner color="grey" small={true} style={styles.offline}>
    Couldn't load all chat messages due to network connectivity. Retrying...
  </Kb.Banner>
)

const LoadingLine = () => {
  const conversationIDKey = C.useChatContext(s => s.id)
  const showLoader = C.Waiting.useAnyWaiting([
    C.Chat.waitingKeyThreadLoad(conversationIDKey),
    C.Chat.waitingKeyInboxSyncStarted,
  ])
  return showLoader ? <Kb.LoadingLine /> : null
}

const hotKeys = ['mod+f']
const Conversation = React.memo(function Conversation() {
  const conversationIDKey = C.useChatContext(s => s.id)
  const navigateAppend = C.Chat.useChatNavigateAppend()
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
  const showThreadSearch = C.useChatContext(s => s.threadSearchInfo.visible)
  const cannotWrite = C.useChatContext(s => s.meta.cannotWrite)
  const threadLoadedOffline = C.useChatContext(s => s.meta.offline)
  const dragAndDropRejectReason = C.useChatContext(s => {
    const meta = s.meta
    const {cannotWrite, minWriterRole} = meta
    return cannotWrite
      ? `You must be at least ${indefiniteArticle(minWriterRole)} ${minWriterRole} to post.`
      : undefined
  })
  const attachmentPasted = C.useChatContext(s => s.dispatch.attachmentPasted)
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
  const toggleThreadSearch = C.useChatContext(s => s.dispatch.toggleThreadSearch)
  const onToggleThreadSearch = React.useCallback(() => {
    toggleThreadSearch()
  }, [toggleThreadSearch])

  return (
    <div className="conversation" style={styles.container} onPaste={onPaste}>
      <Kb.HotKey hotKeys={hotKeys} onHotKey={onToggleThreadSearch} />
      <Kb.DragAndDrop
        onAttach={cannotWrite ? undefined : onAttach}
        fullHeight={true}
        fullWidth={true}
        rejectReason={dragAndDropRejectReason}
      >
        {threadLoadedOffline && <Offline />}
        <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} style={styles.innerContainer}>
          <ListArea key={conversationIDKey} />
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
