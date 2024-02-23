import * as C from '@/constants'
import * as T from '@/constants/types'
import * as RPCChatTypes from '@/constants/types/rpc-chat-gen'
import * as RPCTypes from '@/constants/types/rpc-gen'
import * as React from 'react'
import Normal from '.'
import {OrangeLineContext} from '../orange-line-context'
import {FocusProvider, ScrollProvider} from './context'
import logger from '@/logger'

// Orange line logic:
// When we enter a conversation we call an rpc to see where the line should be. The meta.readMsgID and maxMsgID are not correct
// enough to use directly,
// When the orange line is showing we should maintain that while in that thread. An orange line can move
// while we're in a thread due to marking as unread. Our cached local orange line (in a ref) can be outdated
// by messages being deleted or ordinals changing. If you're up to date we do not show the orange line as
// new messages come in. If you become inactive we will mark it and any new messages will have an orange line
// on top.
const useOrangeLine = () => {
  let needRPC = false
  const [orangeLine, setOrangeLine] = React.useState(T.Chat.numberToOrdinal(0))
  const lastCIDRef = React.useRef<T.Chat.ConversationIDKey>('')
  const CID = C.useChatContext(s => s.id)
  const readMsgID = C.useChatContext(s => s.meta.readMsgID)
  const lastReadMsgIDRef = React.useRef(readMsgID)

  if (CID !== lastCIDRef.current) {
    lastCIDRef.current = CID
    lastReadMsgIDRef.current = readMsgID
    needRPC = true
  }

  if (lastReadMsgIDRef.current > readMsgID) {
    logger.info('[useOrangeLine debug] mark as unread detected')
    lastReadMsgIDRef.current = readMsgID
    needRPC = true
  }

  const lastActiveRef = React.useRef(true)
  const active = C.useActiveState(s => s.active)
  if (active !== lastActiveRef.current) {
    lastActiveRef.current = active
    if (active) {
      needRPC = true
    }
  }

  if (needRPC) {
    const convID = T.Chat.keyToConversationID(CID)
    const f = async () => {
      const unreadlineRes = await RPCChatTypes.localGetUnreadlineRpcPromise({
        convID,
        identifyBehavior: RPCTypes.TLFIdentifyBehavior.chatGui,
        readMsgID: readMsgID < 0 ? 0 : readMsgID,
      })
      const unreadlineID = unreadlineRes.unreadlineID ? unreadlineRes.unreadlineID : 0
      logger.info('[useOrangeLine debug] rpc value: ', unreadlineID)

      if (!unreadlineID) {
        setOrangeLine(T.Chat.numberToOrdinal(0))
        return
      }
      // find ordinal
      const mm = C.Chat._getConvoState(CID).messageMap
      let toSet = T.Chat.numberToOrdinal(unreadlineID)
      const quick = mm.get(toSet)
      if (!quick) {
        // search
        for (const m of mm.values()) {
          if (m.id === unreadlineID) {
            toSet = m.ordinal
            break
          }
        }
      }

      setOrangeLine(toSet)
    }
    C.ignorePromise(f())
  }

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
