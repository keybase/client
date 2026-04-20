import * as C from '@/constants'
import * as ConvoState from '@/stores/convostate'
import {useShellState} from '@/stores/shell'
import * as React from 'react'
import Normal from '.'
import * as T from '@/constants/types'
import {FocusProvider, ScrollProvider} from './context'
import {OrangeLineContext} from '../orange-line-context'
import {useLoadTeamMembers} from '@/teams/team-members'

const useOrangeLine = () => {
  const [orangeLine, setOrangeLine] = React.useState(T.Chat.numberToOrdinal(0))
  const id = ConvoState.useChatContext(s => s.id)
  // Snapshot readMsgID during render (synchronous, before any effects like markThreadAsRead)
  // This ensures we capture the read position before the Go service processes mark-as-read
  const savedReadMsgID = React.useMemo(() => ConvoState.getConvoState(id).meta.readMsgID, [id])

  const loadOrangeLine = React.useEffectEvent((useSavedReadMsgID?: boolean) => {
    const f = async () => {
      const store = ConvoState.getConvoState(id)
      const convID = store.getConvID()
      const readMsgID = useSavedReadMsgID ? savedReadMsgID : store.meta.readMsgID
      const unreadlineRes = await T.RPCChat.localGetUnreadlineRpcPromise({
        convID,
        identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
        readMsgID: readMsgID < 0 ? 0 : readMsgID,
      })
      setOrangeLine(T.Chat.numberToOrdinal(unreadlineRes.unreadlineID ? unreadlineRes.unreadlineID : 0))
    }
    C.ignorePromise(f())
  })

  const loaded = ConvoState.useChatContext(s => s.loaded)

  // Fire when conversation changes or messages finish loading
  // Wait for loaded so the Go service has messages in its local cache
  // On desktop the component doesn't remount on conversation switch, so we depend on id
  React.useEffect(() => {
    setOrangeLine(T.Chat.numberToOrdinal(0))
    if (loaded) {
      loadOrangeLine(true)
    }
  }, [id, loaded])

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
      setOrangeLine(T.Chat.numberToOrdinal(markedAsUnread))
    }
  }, [markedAsUnread])

  // just use the rpc for orange line if we're not active
  // if we are active we want to keep whatever state we had so it is maintained
  const active = useShellState(s => s.active)
  React.useEffect(() => {
    if (!active) {
      loadOrangeLine()
    }
  }, [maxVisibleMsgID, active])

  // mobile backgrounded us
  const mobileAppState = useShellState(s => s.mobileAppState)
  const lastMobileAppStateRef = React.useRef(mobileAppState)
  React.useEffect(() => {
    if (mobileAppState !== lastMobileAppStateRef.current) {
      lastMobileAppStateRef.current = mobileAppState
      if (mobileAppState !== 'active') {
        setOrangeLine(T.Chat.numberToOrdinal(0))
      }
    }
  }, [mobileAppState])
  return orangeLine
}

const NormalWrapper = function NormalWrapper() {
  const {teamID, teamType} = ConvoState.useChatContext(s => s.meta)
  useLoadTeamMembers(teamID, teamType !== 'adhoc')
  const orangeLine = useOrangeLine()
  return (
    <OrangeLineContext value={orangeLine}>
      <FocusProvider>
        <ScrollProvider>
          <Normal />
        </ScrollProvider>
      </FocusProvider>
    </OrangeLineContext>
  )
}
export default NormalWrapper
