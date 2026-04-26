import * as C from '@/constants'
import * as ConvoState from '@/stores/convostate'
import {useShellState} from '@/stores/shell'
import * as React from 'react'
import {useEngineActionListener} from '@/engine/action-listener'
import Normal from '.'
import * as T from '@/constants/types'
import {FocusProvider, ScrollProvider} from './context'
import {OrangeLineContext} from '../orange-line-context'
import {ChatTeamProvider} from '../team-hooks'
import {ConversationInputProvider} from '../input-area/input-state'
import {MaybeMentionProvider} from '@/common-adapters/markdown/maybe-mention/context'

type OrangeLineState = {
  conversationIDKey: T.Chat.ConversationIDKey
  mobileAppState: 'active' | 'background' | 'inactive' | 'unknown'
  orangeLine: T.Chat.Ordinal
}

const useOrangeLine = () => {
  const id = ConvoState.useChatContext(s => s.id)
  const active = useShellState(s => s.active)
  const mobileAppState = useShellState(s => s.mobileAppState)
  const noOrangeLine = T.Chat.numberToOrdinal(0)
  const [orangeLineState, setOrangeLineState] = React.useState<OrangeLineState>(() => ({
    conversationIDKey: id,
    mobileAppState,
    orangeLine: noOrangeLine,
  }))
  let currentOrangeLineState = orangeLineState
  if (orangeLineState.conversationIDKey !== id || orangeLineState.mobileAppState !== mobileAppState) {
    currentOrangeLineState = {
      conversationIDKey: id,
      mobileAppState,
      orangeLine:
        orangeLineState.conversationIDKey === id && mobileAppState === 'active'
          ? orangeLineState.orangeLine
          : noOrangeLine,
    }
    setOrangeLineState(currentOrangeLineState)
  }
  // Snapshot readMsgID during render (synchronous, before any effects like markThreadAsRead)
  // This ensures we capture the read position before the Go service processes mark-as-read
  const savedReadMsgID = React.useMemo(() => ConvoState.getConvoState(id).meta.readMsgID, [id])

  const loadOrangeLine = React.useEffectEvent(
    (conversationIDKey: T.Chat.ConversationIDKey, savedReadMsgID?: T.Chat.MessageID) => {
      const f = async () => {
        const store = ConvoState.getConvoState(conversationIDKey)
        const convID = store.getConvID()
        const readMsgID = savedReadMsgID ?? store.meta.readMsgID
        const unreadlineRes = await T.RPCChat.localGetUnreadlineRpcPromise({
          convID,
          identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
          readMsgID: readMsgID < 0 ? 0 : readMsgID,
        })
        const nextOrangeLine = T.Chat.numberToOrdinal(
          unreadlineRes.unreadlineID ? unreadlineRes.unreadlineID : 0
        )
        setOrangeLineState(state =>
          state.conversationIDKey === conversationIDKey ? {...state, orangeLine: nextOrangeLine} : state
        )
      }
      C.ignorePromise(f())
    }
  )

  const loaded = ConvoState.useChatContext(s => s.loaded)

  // Fire when conversation changes or messages finish loading
  // Wait for loaded so the Go service has messages in its local cache
  // On desktop the component doesn't remount on conversation switch, so we depend on id
  React.useEffect(() => {
    if (loaded) {
      loadOrangeLine(id, savedReadMsgID)
    }
  }, [id, loaded, savedReadMsgID])

  const {markedAsUnread, maxVisibleMsgID} = ConvoState.useChatContext(
    C.useShallow(s => {
      const {maxVisibleMsgID} = s.meta
      const {markedAsUnread} = s
      return {markedAsUnread, maxVisibleMsgID}
    })
  )

  // unread changed things
  const lastMarkedAsUnreadRef = React.useRef(markedAsUnread)
  React.useEffect(() => {
    if (lastMarkedAsUnreadRef.current !== markedAsUnread) {
      lastMarkedAsUnreadRef.current = markedAsUnread
      setOrangeLineState(state =>
        state.conversationIDKey === id
          ? {...state, orangeLine: T.Chat.numberToOrdinal(markedAsUnread)}
          : state
      )
    }
  }, [id, markedAsUnread])

  // just use the rpc for orange line if we're not active
  // if we are active we want to keep whatever state we had so it is maintained
  React.useEffect(() => {
    if (!active) {
      loadOrangeLine(id)
    }
  }, [maxVisibleMsgID, active, id])

  return currentOrangeLineState.orangeLine
}

const useShowManageChannels = () => {
  const navigateAppend = C.Router2.navigateAppend
  const {teamID, teamname} = ConvoState.useChatContext(
    C.useShallow(s => ({teamID: s.meta.teamID, teamname: s.meta.teamname}))
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

const NormalWrapper = function NormalWrapper() {
  const conversationIDKey = ConvoState.useChatContext(s => s.id)
  const orangeLine = useOrangeLine()
  useShowManageChannels()
  return (
    <MaybeMentionProvider>
      <OrangeLineContext value={orangeLine}>
        <ChatTeamProvider>
          <ConversationInputProvider key={conversationIDKey} id={conversationIDKey}>
            <FocusProvider>
              <ScrollProvider>
                <Normal />
              </ScrollProvider>
            </FocusProvider>
          </ConversationInputProvider>
        </ChatTeamProvider>
      </OrangeLineContext>
    </MaybeMentionProvider>
  )
}
export default NormalWrapper
