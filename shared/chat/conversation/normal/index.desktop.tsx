import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import type * as React from 'react'
import {PerfProfiler} from '@/perf/react-profiler'
import Banner from '../bottom-banner'
import InputArea from '../input-area/container'
import InvitationToBlock from '@/chat/blocking/invitation-to-block'
import ListArea from '../list-area'
import PinnedMessage from '../pinned-message'
import ThreadLoadStatus from '../load-status'
import ThreadSearch from '../search'
import {useConversationCenter} from '../center-context'
import {useConversationThreadID, useConversationThreadMeta, useConversationThreadToggleSearch} from '../thread-context'
import {useThreadSearchRoute} from '../thread-search-route'
import {readImageFromClipboard} from '@/util/clipboard.desktop'
import '../conversation.css'
import {indefiniteArticle} from '@/util/string'
import {makePasteAttachment} from '../attachment-actions'

const Offline = () => (
  <Kb.Banner color="grey" small={true} style={styles.offline}>
    {"Couldn't load all chat messages due to network connectivity. Retrying..."}
  </Kb.Banner>
)

const LoadingLine = () => {
  const conversationIDKey = useConversationThreadID()
  const showLoader = C.Waiting.useAnyWaiting([
    C.waitingKeyChatThreadLoad(conversationIDKey),
    C.waitingKeyChatInboxSyncStarted,
  ])
  return showLoader ? <Kb.LoadingLine /> : null
}

const Conversation = function Conversation() {
  const conversationIDKey = useConversationThreadID()
  const navigateAppend = C.Router2.navigateAppend
  const onAttach = (paths: Array<string>) => {
    const pathAndOutboxIDs = paths.map(p => ({path: p}))
    navigateAppend({
      name: 'chatAttachmentGetTitles',
      params: {conversationIDKey, pathAndOutboxIDs},
    })
  }
  const showThreadSearch = !!useThreadSearchRoute()
  const meta = useConversationThreadMeta()
  const {cannotWrite, minWriterRole} = meta
  const threadLoadedOffline = meta.offline
  const dragAndDropRejectReason = cannotWrite
    ? `You must be at least ${indefiniteArticle(minWriterRole)} ${minWriterRole} to post.`
    : undefined
  const onPaste = (e: React.SyntheticEvent) => {
    readImageFromClipboard(e)
      .then(clipboardData => {
        if (clipboardData) {
          makePasteAttachment(conversationIDKey, clipboardData)
        }
      })
      .catch(() => {})
  }
  const toggleThreadSearch = useConversationThreadToggleSearch()
  const {clearCenter} = useConversationCenter()
  const onToggleThreadSearch = () => {
    if (showThreadSearch) {
      clearCenter()
    }
    toggleThreadSearch()
  }
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
        <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} flex={1} relative={true}>
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
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      container: {
        ...Kb.Styles.globalStyles.flexBoxColumn,
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

const ConversationWithProfiler = () => (
  <PerfProfiler id="Conversation">
    <Conversation />
  </PerfProfiler>
)

export default ConversationWithProfiler
