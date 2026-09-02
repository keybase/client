import * as C from '@/constants'
import {type State as ShellState, useShellState} from '@/stores/shell'
import * as React from 'react'
import {useEngineActionListener} from '@/engine/action-listener'
import Normal from '.'
import * as T from '@/constants/types'
import {ThreadRefsProvider} from './context'
import {OrangeLineContext, SetOrangeLineContext, useExplicitOrangeLineState} from '../orange-line-context'
import {ChatTeamProvider} from '../team-hooks'
import {ConversationCenterProvider} from '../center-context'
import {ConversationInputProvider} from '../input-area/input-state'
import {
  useConversationThreadID,
  useConversationThreadSelector,
  useThreadMeta,
} from '../thread-context'
import {ConversationThreadLoadStatusProvider} from '../thread-load-status-context'
import {MaybeMentionProvider} from '@/common-adapters/markdown/maybe-mention/context'
import {peekInputIntent} from '../input-intent-store'
import {useChatThreadRouteParams} from '../thread-search-route'

type OrangeLineState = {
  mobileAppState: ShellState['mobileAppState']
  orangeLine: T.Chat.Ordinal
}

type OrangeLineKey = {
  conversationIDKey: T.Chat.ConversationIDKey
  mobileAppState: ShellState['mobileAppState']
}

const noOrangeLine = T.Chat.numberToOrdinal(0)

const getVisibleOrangeLine = (
  state: OrangeLineState,
  mobileAppState: ShellState['mobileAppState']
): T.Chat.Ordinal => {
  if (state.mobileAppState === mobileAppState || mobileAppState === 'active') {
    return state.orangeLine
  }

  return noOrangeLine
}

const useOrangeLine = (
  id: T.Chat.ConversationIDKey,
  active: boolean,
  mobileAppState: ShellState['mobileAppState']
) => {
  const [orangeLineState, setOrangeLineState] = React.useState<OrangeLineState>(() => ({
    mobileAppState,
    orangeLine: noOrangeLine,
  }))
  const currentOrangeLineKeyRef = React.useRef<OrangeLineKey>({conversationIDKey: id, mobileAppState})
  React.useLayoutEffect(() => {
    currentOrangeLineKeyRef.current = {conversationIDKey: id, mobileAppState}
  }, [id, mobileAppState])
  const {maxVisibleMsgID, readMsgID} = useThreadMeta(
    C.useShallow(m => ({maxVisibleMsgID: m.maxVisibleMsgID, readMsgID: m.readMsgID}))
  )
  // Keep the read position from when this conversation mounted. Mark-as-read updates readMsgID
  // shortly after navigation, but the open thread should retain its orange line.
  //
  // An unlocalized conversation reads -1 ("not known yet"), which a DB nuke makes the norm, so
  // freezing on mount would pin that and the thread would never get an orange line for the life of
  // the mount. Wait for the first real value instead.
  const [mountReadMsgID] = React.useState(() => readMsgID)
  // Fall back to the live value only while the mount-time one is unknown; once the latch below
  // fires it stops mattering, so this cannot drift as mark-as-read moves readMsgID.
  const initialReadMsgID = mountReadMsgID >= 0 ? mountReadMsgID : readMsgID

  const loadOrangeLine = React.useEffectEvent(
    (conversationIDKey: T.Chat.ConversationIDKey, readMsgID: T.Chat.MessageID) => {
      // Negative means we do not know the read position yet: an unlocalized conversation reads -1
      // from emptyConversationMeta, which a DB nuke makes the norm, and the old code turned that
      // into 0 - so the service answered "everything is unread" and put the line above the oldest
      // message. Since the state is set once and only refreshed while the conversation is
      // inactive, that answer stuck.
      //
      // Zero is different and must still be asked: ReaderInfo reports 0 for a conversation you
      // have genuinely never read, where "everything is unread" is the right answer.
      if (readMsgID < 0) {
        return
      }
      const f = async () => {
        const convID = T.Chat.keyToConversationID(conversationIDKey)
        const unreadlineRes = await T.RPCChat.localGetUnreadlineRpcPromise({
          convID,
          identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
          readMsgID,
        })
        const nextOrangeLine = T.Chat.numberToOrdinal(
          unreadlineRes.unreadlineID ? unreadlineRes.unreadlineID : 0
        )
        const currentKey = currentOrangeLineKeyRef.current
        if (currentKey.conversationIDKey !== conversationIDKey) {
          return
        }
        setOrangeLineState(prev => {
          if (prev.orangeLine !== noOrangeLine) {
            return prev
          }
          return {
            mobileAppState: currentKey.mobileAppState,
            orangeLine: nextOrangeLine,
          }
        })
      }
      C.ignorePromise(f())
    }
  )

  const loaded = useConversationThreadSelector(s => s.loaded)

  // Wait for loaded so the Go service has messages in its local cache. Only once: `loaded` flips
  // back to false on every thread reload (search jump, jump to recent), and refetching then would
  // ask the service for the unreadline against our mount-time read position, which now sits behind
  // messages we sent ourselves.
  const initialOrangeLineLoadedRef = React.useRef(false)
  React.useEffect(() => {
    // Only claim the latch once there is a read position to ask about, so an unlocalized
    // conversation gets its orange line when localization lands rather than never.
    if (loaded && !initialOrangeLineLoadedRef.current && initialReadMsgID >= 0) {
      initialOrangeLineLoadedRef.current = true
      loadOrangeLine(id, initialReadMsgID)
    }
  }, [id, loaded, initialReadMsgID])

  // just use the rpc for orange line if we're not active
  // if we are active we want to keep whatever state we had so it is maintained
  React.useEffect(() => {
    if (!active) {
      loadOrangeLine(id, readMsgID)
    }
  }, [maxVisibleMsgID, active, id, readMsgID])

  const setOrangeLine = React.useEffectEvent((ordinal: T.Chat.Ordinal) => {
    const currentKey = currentOrangeLineKeyRef.current
    if (currentKey.conversationIDKey !== id) {
      return
    }
    setOrangeLineState({
      mobileAppState: currentKey.mobileAppState,
      orangeLine: ordinal,
    })
  })

  const explicitOrangeLine = useExplicitOrangeLineState(s => s.updates.get(id))
  const explicitOrangeLineVersionRef = React.useRef(explicitOrangeLine?.version ?? 0)
  React.useEffect(() => {
    if (!explicitOrangeLine || explicitOrangeLine.version <= explicitOrangeLineVersionRef.current) {
      return
    }
    explicitOrangeLineVersionRef.current = explicitOrangeLine.version
    setOrangeLine(explicitOrangeLine.ordinal)
  }, [explicitOrangeLine, id])

  return {orangeLine: getVisibleOrangeLine(orangeLineState, mobileAppState), setOrangeLine}
}

const useShowManageChannels = () => {
  const navigateAppend = C.Router2.navigateAppend
  const {teamID, teamname} = useThreadMeta(
    C.useShallow(m => ({teamID: m.teamID, teamname: m.teamname}))
  )
  useEngineActionListener('chat.1.chatUi.chatShowManageChannels', action => {
    if (
      teamID &&
      teamID !== T.Teams.noTeamID &&
      teamname &&
      action.payload.params.teamname === teamname
    ) {
      navigateAppend({name: 'teamAddToChannels', params: {teamID}})
    }
  })
}

type OrangeLineProviderProps = React.PropsWithChildren<{
  active: boolean
  conversationIDKey: T.Chat.ConversationIDKey
  mobileAppState: ShellState['mobileAppState']
}>

const NormalOrangeLineProvider = (props: OrangeLineProviderProps) => {
  const {active, children, conversationIDKey, mobileAppState} = props
  const {orangeLine, setOrangeLine} = useOrangeLine(conversationIDKey, active, mobileAppState)

  return (
    <OrangeLineContext value={orangeLine}>
      <SetOrangeLineContext value={setOrangeLine}>{children}</SetOrangeLineContext>
    </OrangeLineContext>
  )
}

// Keyed on the conversation by its caller, so the peek runs in a useState initializer exactly
// once per conversation - before ConversationCenterProvider, mounted below, consumes the intent.
// A useMemo would not do: React may drop and recompute one, and a later recompute would read an
// already-consumed mailbox and flip the answer.
//
// Peek, don't consume. A pending 'highlight' means the center provider is about to issue a
// centered load, so the plain 'focused' load on selection would be a wasted second fetch.
//
// It feeds skipThreadLoadOnSelection ONLY. allowMarkReadOnLoad must stay live: it is read by
// reloadStaleThread on every ChatThreadsStale/ChatInboxSynced, and a highlight's mark-read block
// is not permanent - thread-context releases it once the user scrolls to the latest message
// (applyThreadLoad, scrollDirection 'forward' with no moreToLoad) or jumps to recent. That live
// block already gates mark-read inside the thread provider, so repeating it here could only
// freeze it past its release.
const NormalThreadProviders = (
  p: React.PropsWithChildren<{id: T.Chat.ConversationIDKey; threadSearchVisible: boolean}>
) => {
  const {children, id, threadSearchVisible} = p
  const [pendingHighlight] = React.useState(() => !!peekInputIntent(id, ['highlight']))
  return (
    <ConversationThreadLoadStatusProvider
      allowMarkReadOnLoad={!threadSearchVisible}
      id={id}
      skipThreadLoadOnSelection={pendingHighlight}
    >
      {children}
    </ConversationThreadLoadStatusProvider>
  )
}

const NormalWrapper = function NormalWrapper() {
  const conversationIDKey = useConversationThreadID()
  const {active, mobileAppState} = useShellState(
    C.useShallow(s => ({active: s.active, mobileAppState: s.mobileAppState}))
  )
  const routeParams = useChatThreadRouteParams()
  const threadSearchVisible = !!routeParams?.threadSearch
  useShowManageChannels()
  return (
    <MaybeMentionProvider>
      <NormalOrangeLineProvider
        key={conversationIDKey}
        active={active}
        conversationIDKey={conversationIDKey}
        mobileAppState={mobileAppState}
      >
        <ChatTeamProvider>
          <NormalThreadProviders
            key={conversationIDKey}
            id={conversationIDKey}
            threadSearchVisible={threadSearchVisible}
          >
            <ConversationCenterProvider id={conversationIDKey}>
              <ConversationInputProvider key={conversationIDKey} id={conversationIDKey}>
                <ThreadRefsProvider>
                  <Normal />
                </ThreadRefsProvider>
              </ConversationInputProvider>
            </ConversationCenterProvider>
          </NormalThreadProviders>
        </ChatTeamProvider>
      </NormalOrangeLineProvider>
    </MaybeMentionProvider>
  )
}
export default NormalWrapper
