import * as C from '@/constants'
import * as Chat from '@/stores/chat2'
import {useConfigState} from '@/stores/config'
import * as React from 'react'
import Normal from '.'
import * as T from '@/constants/types'
import {FocusProvider, ScrollProvider} from './context'
import {OrangeLineContext} from '../orange-line-context'

const useOrangeLine = () => {
  const [orangeLine, setOrangeLine] = React.useState(T.Chat.numberToOrdinal(0))
  const id = Chat.useChatContext(s => s.id)
  // this hook only deals with the active changes, otherwise the rest of the logic is in the store
  const loadOrangeLine = React.useCallback(() => {
    const f = async () => {
      const store = Chat.getConvoState(id)
      const convID = store.getConvID()
      const readMsgID = store.meta.readMsgID
      const unreadlineRes = await T.RPCChat.localGetUnreadlineRpcPromise({
        convID,
        identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
        readMsgID: readMsgID < 0 ? 0 : readMsgID,
      })
      setOrangeLine(T.Chat.numberToOrdinal(unreadlineRes.unreadlineID ? unreadlineRes.unreadlineID : 0))
    }
    C.ignorePromise(f())
  }, [id])

  // initial load
  React.useEffect(() => {
    loadOrangeLine()
  }, [loadOrangeLine])

  const {markedAsUnread, maxVisibleMsgID} = Chat.useChatContext(
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
  }, [loadOrangeLine, markedAsUnread])

  // just use the rpc for orange line if we're not active
  // if we are active we want to keep whatever state we had so it is maintained
  const active = useConfigState(s => s.active)
  React.useEffect(() => {
    if (!active) {
      loadOrangeLine()
    }
  }, [maxVisibleMsgID, loadOrangeLine, active])

  // mobile backgrounded us
  const mobileAppState = useConfigState(s => s.mobileAppState)
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

const NormalWrapper = React.memo(function NormalWrapper() {
  const orangeLine = useOrangeLine()
  return (
    <OrangeLineContext.Provider value={orangeLine}>
      <FocusProvider>
        <ScrollProvider>
          <Normal />
        </ScrollProvider>
      </FocusProvider>
    </OrangeLineContext.Provider>
  )
})
export default NormalWrapper
