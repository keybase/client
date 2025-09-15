import * as C from '@/constants'
import * as React from 'react'
import Normal from '.'
import * as T from '@/constants/types'
import {FocusProvider, ScrollProvider} from './context'
import {OrangeLineContext} from '../orange-line-context'

const useOrangeLine = () => {
  const [orangeLine, setOrangeLine] = React.useState(T.Chat.numberToOrdinal(0))
  const id = C.useChatContext(s => s.id)
  // this hook only deals with the active changes, otherwise the rest of the logic is in the store
  const loadOrangeLine = React.useCallback(() => {
    const f = async () => {
      const store = C.getConvoState(id)
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

  const {markedAsUnread, maxMsgID, readMsgID} = C.useChatContext(
    C.useShallow(s => {
      const {maxMsgID, readMsgID} = s.meta
      const {markedAsUnread} = s
      return {markedAsUnread, maxMsgID, readMsgID}
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

  // we're not looking add a line
  const active = C.useActiveState(s => s.active)
  React.useEffect(() => {
    if (!active && readMsgID < maxMsgID) {
      setOrangeLine(T.Chat.numberToOrdinal(readMsgID + 0.0001))
    }
  }, [active, maxMsgID, readMsgID])

  // mobile backgrounded us
  const mobileAppState = C.useConfigState(s => s.mobileAppState)
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

const WithOrange = React.memo(function WithOrange(p: {orangeLine: T.Chat.Ordinal}) {
  return (
    <OrangeLineContext.Provider value={p.orangeLine}>
      <FocusProvider>
        <ScrollProvider>
          <Normal />
        </ScrollProvider>
      </FocusProvider>
    </OrangeLineContext.Provider>
  )
})

const NormalWrapper = React.memo(function NormalWrapper() {
  const orangeLine = useOrangeLine()
  return <WithOrange orangeLine={orangeLine} />
})
export default NormalWrapper
