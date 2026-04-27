import * as C from '@/constants'
import * as ConvoState from '@/stores/convostate'
import {type State as ShellState, useShellState} from '@/stores/shell'
import * as React from 'react'
import {useEngineActionListener} from '@/engine/action-listener'
import Normal from '.'
import * as T from '@/constants/types'
import {FocusProvider, ScrollProvider} from './context'
import {OrangeLineContext, SetOrangeLineContext} from '../orange-line-context'
import {ChatTeamProvider} from '../team-hooks'
import {ConversationCenterProvider} from '../center-context'
import {ConversationInputProvider} from '../input-area/input-state'
import {ConversationThreadLoadStatusProvider} from '../thread-load-status-context'
import {MaybeMentionProvider} from '@/common-adapters/markdown/maybe-mention/context'
import {useChatThreadRouteParams} from '../thread-search-route'

type OrangeLineState = {
  conversationIDKey: T.Chat.ConversationIDKey
  mobileAppState: ShellState['mobileAppState']
  orangeLine: T.Chat.Ordinal
}

type OrangeLineKey = Omit<OrangeLineState, 'orangeLine'>

const noOrangeLine = T.Chat.numberToOrdinal(0)

const getCurrentOrangeLineState = (
  state: OrangeLineState,
  conversationIDKey: T.Chat.ConversationIDKey,
  mobileAppState: ShellState['mobileAppState']
): OrangeLineState => {
  if (state.conversationIDKey === conversationIDKey && state.mobileAppState === mobileAppState) {
    return state
  }

  return {
    conversationIDKey,
    mobileAppState,
    orangeLine:
      state.conversationIDKey === conversationIDKey && mobileAppState === 'active'
        ? state.orangeLine
        : noOrangeLine,
  }
}

const useOrangeLine = () => {
  const id = ConvoState.useChatContext(s => s.id)
  const {active, mobileAppState} = useShellState(
    C.useShallow(s => ({active: s.active, mobileAppState: s.mobileAppState}))
  )
  const [orangeLineState, setOrangeLineState] = React.useState<OrangeLineState>(() => ({
    conversationIDKey: id,
    mobileAppState,
    orangeLine: noOrangeLine,
  }))
  const currentOrangeLineState = getCurrentOrangeLineState(orangeLineState, id, mobileAppState)
  const currentOrangeLineKeyRef = React.useRef<OrangeLineKey>({conversationIDKey: id, mobileAppState})
  React.useLayoutEffect(() => {
    currentOrangeLineKeyRef.current = {conversationIDKey: id, mobileAppState}
    setOrangeLineState(state => getCurrentOrangeLineState(state, id, mobileAppState))
  }, [id, mobileAppState])
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
        const currentKey = currentOrangeLineKeyRef.current
        if (currentKey.conversationIDKey !== conversationIDKey) {
          return
        }
        setOrangeLineState(state => ({
          ...getCurrentOrangeLineState(state, currentKey.conversationIDKey, currentKey.mobileAppState),
          orangeLine: nextOrangeLine,
        }))
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

  const maxVisibleMsgID = ConvoState.useChatContext(s => s.meta.maxVisibleMsgID)

  // just use the rpc for orange line if we're not active
  // if we are active we want to keep whatever state we had so it is maintained
  React.useEffect(() => {
    if (!active) {
      loadOrangeLine(id)
    }
  }, [maxVisibleMsgID, active, id])

  const setOrangeLine = (messageID: T.Chat.MessageID) => {
    const currentKey = currentOrangeLineKeyRef.current
    if (currentKey.conversationIDKey !== id) {
      return
    }
    const orangeLine = T.Chat.numberToOrdinal(T.Chat.messageIDToNumber(messageID))
    setOrangeLineState(state => ({
      ...getCurrentOrangeLineState(state, currentKey.conversationIDKey, currentKey.mobileAppState),
      orangeLine,
    }))
  }

  return {orangeLine: currentOrangeLineState.orangeLine, setOrangeLine}
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
  const {orangeLine, setOrangeLine} = useOrangeLine()
  const routeParams = useChatThreadRouteParams()
  const skipThreadLoadOnSelection = !!routeParams?.highlightMessageID
  useShowManageChannels()
  return (
    <MaybeMentionProvider>
      <OrangeLineContext value={orangeLine}>
        <SetOrangeLineContext value={setOrangeLine}>
          <ChatTeamProvider>
            <ConversationThreadLoadStatusProvider
              key={conversationIDKey}
              id={conversationIDKey}
              skipThreadLoadOnSelection={skipThreadLoadOnSelection}
            >
              <ConversationCenterProvider id={conversationIDKey}>
                <ConversationInputProvider key={conversationIDKey} id={conversationIDKey}>
                  <FocusProvider>
                    <ScrollProvider>
                      <Normal />
                    </ScrollProvider>
                  </FocusProvider>
                </ConversationInputProvider>
              </ConversationCenterProvider>
            </ConversationThreadLoadStatusProvider>
          </ChatTeamProvider>
        </SetOrangeLineContext>
      </OrangeLineContext>
    </MaybeMentionProvider>
  )
}
export default NormalWrapper
