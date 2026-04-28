import * as C from '@/constants'
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
import {
  useConversationThreadID,
  useConversationThreadLoaded,
  useConversationThreadMeta,
} from '../thread-context'
import {ConversationThreadLoadStatusProvider} from '../thread-load-status-context'
import {MaybeMentionProvider} from '@/common-adapters/markdown/maybe-mention/context'
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
  const meta = useConversationThreadMeta()
  // Keep the read position from when this conversation mounted. Mark-as-read updates
  // meta.readMsgID shortly after navigation, but the open thread should retain its orange line.
  const [initialReadMsgID] = React.useState(() => meta.readMsgID)

  const loadOrangeLine = React.useEffectEvent(
    (conversationIDKey: T.Chat.ConversationIDKey, readMsgID: T.Chat.MessageID) => {
      const f = async () => {
        const convID = T.Chat.keyToConversationID(conversationIDKey)
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
        setOrangeLineState({
          mobileAppState: currentKey.mobileAppState,
          orangeLine: nextOrangeLine,
        })
      }
      C.ignorePromise(f())
    }
  )

  const loaded = useConversationThreadLoaded()

  // Wait for loaded so the Go service has messages in its local cache
  React.useEffect(() => {
    if (loaded) {
      loadOrangeLine(id, initialReadMsgID)
    }
  }, [id, loaded, initialReadMsgID])

  const maxVisibleMsgID = meta.maxVisibleMsgID

  // just use the rpc for orange line if we're not active
  // if we are active we want to keep whatever state we had so it is maintained
  React.useEffect(() => {
    if (!active) {
      loadOrangeLine(id, meta.readMsgID)
    }
  }, [maxVisibleMsgID, active, id, meta.readMsgID])

  const setOrangeLine = (messageID: T.Chat.MessageID) => {
    const currentKey = currentOrangeLineKeyRef.current
    if (currentKey.conversationIDKey !== id) {
      return
    }
    const orangeLine = T.Chat.numberToOrdinal(T.Chat.messageIDToNumber(messageID))
    setOrangeLineState({
      mobileAppState: currentKey.mobileAppState,
      orangeLine,
    })
  }

  return {orangeLine: getVisibleOrangeLine(orangeLineState, mobileAppState), setOrangeLine}
}

const useShowManageChannels = () => {
  const navigateAppend = C.Router2.navigateAppend
  const {teamID, teamname} = useConversationThreadMeta()
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

const NormalProviderChildren = (props: {
  active: boolean
  conversationIDKey: T.Chat.ConversationIDKey
  mobileAppState: ShellState['mobileAppState']
  skipThreadLoadOnSelection: boolean
}) => {
  const {active, conversationIDKey, mobileAppState, skipThreadLoadOnSelection} = props
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
      </NormalOrangeLineProvider>
    </MaybeMentionProvider>
  )
}

const NormalWrapper = function NormalWrapper() {
  const conversationIDKey = useConversationThreadID()
  const {active, mobileAppState} = useShellState(
    C.useShallow(s => ({active: s.active, mobileAppState: s.mobileAppState}))
  )
  const routeParams = useChatThreadRouteParams()
  const skipThreadLoadOnSelection = !!routeParams?.highlightMessageID
  return (
    <NormalProviderChildren
      active={active}
      conversationIDKey={conversationIDKey}
      mobileAppState={mobileAppState}
      skipThreadLoadOnSelection={skipThreadLoadOnSelection}
    />
  )
}
export default NormalWrapper
