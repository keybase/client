import * as C from '@/constants'
import * as React from 'react'
import Normal from '.'
import {OrangeLineContext} from '../orange-line-context'
import {FocusProvider, ScrollProvider} from './context'

// Orange line logic:
// While looking at a thread the line should be static
// If you aren't active (backgrounded on desktop) the orange line will appear above new content
// If you are active and new items get added the orange line will be consistent, either where it was on first
// mount or not there at all (active and new items come)
// Handle mark as unread
const useOrangeLine = () => {
  const conversationIDKey = C.useChatContext(s => s.id)
  const readMsgID = C.useChatContext(s => s.meta.readMsgID)
  const maxMsgID = C.useChatContext(s => s.meta.maxMsgID)
  const active = C.useActiveState(s => s.active)
  const reinitValue = maxMsgID > readMsgID ? readMsgID : 0
  const orangeLineRef = React.useRef(reinitValue)
  const lastCIDRef = React.useRef(conversationIDKey)
  const lastReadMsgIDRef = React.useRef(readMsgID)
  const metaGoodRef = React.useRef(readMsgID > 0)

  // TEMP
  const TEMPMM = C.useChatContext(s => s.messageMap)

  // meta not ready yet
  if (readMsgID < 0) {
    console.log('aaa orange bad meta', conversationIDKey)
    return 0
  }

  // init on first good met
  if (!metaGoodRef.current) {
    metaGoodRef.current = true
    lastReadMsgIDRef.current = readMsgID
    orangeLineRef.current = reinitValue
  }

  // convo changed? reset
  if (lastCIDRef.current !== conversationIDKey) {
    lastCIDRef.current = conversationIDKey
    lastReadMsgIDRef.current = readMsgID
    orangeLineRef.current = reinitValue
  }

  // not active and we should show?
  if (!active && reinitValue && orangeLineRef.current <= 0) {
    orangeLineRef.current = reinitValue
  }

  // mark unread
  if (readMsgID < lastReadMsgIDRef.current) {
    lastReadMsgIDRef.current = readMsgID
    orangeLineRef.current = readMsgID
  }

  console.log('aaa orange', {
    active,
    conversationIDKey,
    lastCIDRef,
    lastReadMsgIDRef,
    maxMsgID,
    metaGoodRef,
    orangeLineRef,
    readMsgID,
    reinitValue,
    TEMPBelow: TEMPMM.get(orangeLineRef.current)?.text?.stringValue(),
  })

  return orangeLineRef.current
}

const WithOrange = React.memo(function WithOrange(p: {orangeLine: number}) {
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
