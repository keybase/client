import * as C from '@/constants'
import type * as T from '@/constants/types'
// import * as RPCChatTypes from '@/constants/types/rpc-chat-gen'
// import * as RPCTypes from '@/constants/types/rpc-gen'
import * as React from 'react'
import Normal from '.'
import {OrangeLineContext} from '../orange-line-context'
import {FocusProvider, ScrollProvider} from './context'
// import logger from '@/logger'

// Orange line logic:
// When we enter a conversation we call an rpc to see where the line should be. The meta.readMsgID and maxMsgID are not correct
// enough to use directly,
// When the orange line is showing we should maintain that while in that thread. An orange line can move
// while we're in a thread due to marking as unread. Our cached local orange line (in a ref) can be outdated
// by messages being deleted or ordinals changing. If you're up to date we do not show the orange line as
// new messages come in. If you become inactive we will mark it and any new messages will have an orange line
// on top.
const useOrangeLine = () => {
  // let needRPC = false
  // const [orangeLine, setOrangeLine] = React.useState(T.Chat.numberToOrdinal(0))

  // TODO pull from store

  // const CID = C.useChatContext(s => s.id)
  // const readMsgID = C.useChatContext(s => s.meta.readMsgID)
  // const maxVisibleMsgID = C.useChatContext(s => s.meta.maxVisibleMsgID)
  //
  // const lastCIDRef = React.useRef<T.Chat.ConversationIDKey>('')
  // const lastReadMsgIDRef = React.useRef(readMsgID)
  // const lastVisibleMsgIDRef = React.useRef(maxVisibleMsgID)
  //
  // if (CID !== lastCIDRef.current) {
  //   lastCIDRef.current = CID
  //   lastReadMsgIDRef.current = readMsgID
  //   lastVisibleMsgIDRef.current = maxVisibleMsgID
  //   needRPC = true
  // }
  //
  // if (lastReadMsgIDRef.current > readMsgID) {
  //   logger.info('[useOrangeLine debug] mark as unread detected')
  //   lastReadMsgIDRef.current = readMsgID
  //   needRPC = true
  // }
  //
  // // desktop if we're not active and new messages came in, get the orange line
  // const active = C.useActiveState(s => s.active)
  // if (!active) {
  //   if (maxVisibleMsgID > lastVisibleMsgIDRef.current) {
  //     logger.info('[useOrangeLine debug] active with new messages detected')
  //     lastVisibleMsgIDRef.current = maxVisibleMsgID
  //     needRPC = true
  //   }
  // }
  // // mobile if we background, clear the orange line
  // const mobileAppState = C.useConfigState(s => s.mobileAppState)
  // const lastMobileAppStateRef = React.useRef(mobileAppState)
  // if (mobileAppState !== lastMobileAppStateRef.current) {
  //   lastMobileAppStateRef.current = mobileAppState
  //   if (mobileAppState !== 'active') {
  //     logger.info('[useOrangeLine debug] mobile app state not active, lose orange line')
  //     setOrangeLine(T.Chat.numberToOrdinal(0))
  //   } else {
  //     logger.info('[useOrangeLine debug] mobile app state active detected')
  //     needRPC = true
  //   }
  // }
  //
  // // meta is good now?
  // if (maxVisibleMsgID && !lastVisibleMsgIDRef.current) {
  //   logger.info('[useOrangeLine debug] now valid meta detected')
  //   lastVisibleMsgIDRef.current = maxVisibleMsgID
  //   needRPC = true
  // }

  // no orange line but got new messages, just check
  // if (!orangeLine && maxVisibleMsgID > lastVisibleMsgIDRef.current) {
  //   logger.info('[useOrangeLine debug] no orange but new messages')
  //   lastVisibleMsgIDRef.current = maxVisibleMsgID
  //   needRPC = true
  // }
  //
  // if (needRPC) {
  //   const convID = T.Chat.keyToConversationID(CID)
  //   const f = async () => {
  //     await C.timeoutPromise(1000)
  //     const unreadlineRes = await RPCChatTypes.localGetUnreadlineRpcPromise({
  //       convID,
  //       identifyBehavior: RPCTypes.TLFIdentifyBehavior.chatGui,
  //       readMsgID: readMsgID < 0 ? 0 : readMsgID,
  //     })
  //     const unreadlineID = unreadlineRes.unreadlineID ? unreadlineRes.unreadlineID : 0
  //     logger.info('[useOrangeLine debug] rpc value: ', unreadlineID)
  //
  //     if (!unreadlineID) {
  //       setOrangeLine(T.Chat.numberToOrdinal(0))
  //       return
  //     }
  //     // find ordinal
  //     const mm = C.Chat._getConvoState(CID).messageMap
  //     let toSet = T.Chat.numberToOrdinal(unreadlineID)
  //     const quick = mm.get(toSet)
  //     if (!quick) {
  //       // search
  //       for (const m of mm.values()) {
  //         if (m.id === unreadlineID) {
  //           toSet = m.ordinal
  //           break
  //         }
  //       }
  //     }
  //
  //     setOrangeLine(toSet)
  //   }
  //
  //   f()
  //     .then(() => {})
  //     .catch(e => {
  //       logger.info('[useOrangeLine debug] error: ', e)
  //     })
  //     .finally(() => {
  //       logger.info('[useOrangeLine debug] finally')
  //     })
  // }

  // return orangeLine

  const orangeLine = C.useChatContext(s => s.orangeAboveOrdinal)
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
